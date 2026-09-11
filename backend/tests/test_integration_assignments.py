from io import BytesIO

import pytest
from reportlab.pdfgen import canvas

pytestmark = pytest.mark.integration



def _create_operation(client, auth_headers):
    return client.post('/api/operations/', headers=auth_headers, json={'title': 'Lage A'}).get_json()



def _create_vehicle(client, auth_headers, callsign='FL-1', status='available'):
    response = client.post(
        '/api/vehicles/',
        headers=auth_headers,
        json={'callsign': callsign, 'crew_count': 3, 'status': status},
    )
    return response.get_json()



def _pdf_bytes(text='TEL PDF'):
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer)
    pdf.drawString(100, 750, text)
    pdf.save()
    buffer.seek(0)
    return buffer.read()



def test_assignment_create_update_status_and_vehicle_flow(client, auth_headers):
    operation = _create_operation(client, auth_headers)
    vehicle = _create_vehicle(client, auth_headers)

    created = client.post(
        '/api/assignments/',
        headers=auth_headers,
        json={
            'operation_id': operation['id'],
            'title': 'Baum auf Straße',
            'location_address': 'Mainzer Landstraße 1',
        },
    )
    assert created.status_code == 201
    assignment = created.get_json()
    assert assignment['number'].endswith('-001')
    assert assignment['status'] == 'open'

    updated = client.put(
        f"/api/assignments/{assignment['id']}",
        headers=auth_headers,
        json={'description': 'Dringend', 'latitude': 50.2, 'longitude': 8.7},
    )
    assert updated.status_code == 200
    assert updated.get_json()['description'] == 'Dringend'

    assign_vehicle = client.post(
        f"/api/assignments/{assignment['id']}/vehicles",
        headers=auth_headers,
        json={'vehicle_id': vehicle['id']},
    )
    assert assign_vehicle.status_code == 200
    assert assign_vehicle.get_json()['status'] == 'assigned'

    duplicate_assignment = client.post(
        f"/api/assignments/{assignment['id']}/vehicles",
        headers=auth_headers,
        json={'vehicle_id': vehicle['id']},
    )
    assert duplicate_assignment.status_code == 409
    assert duplicate_assignment.get_json()['error']['code'] == 'vehicle_already_assigned'

    vehicle_state = client.get(f"/api/vehicles/{vehicle['id']}")
    assert vehicle_state.get_json()['status'] == 'alerted'

    in_progress = client.post(
        f"/api/assignments/{assignment['id']}/status",
        headers=auth_headers,
        json={'status': 'in_progress'},
    )
    assert in_progress.status_code == 200
    assert in_progress.get_json()['status'] == 'in_progress'

    invalid_back_transition = client.post(
        f"/api/assignments/{assignment['id']}/status",
        headers=auth_headers,
        json={'status': 'open'},
    )
    assert invalid_back_transition.status_code == 400
    assert invalid_back_transition.get_json()['error']['code'] == 'invalid_status_transition'

    complete = client.post(f"/api/assignments/{assignment['id']}/complete", headers=auth_headers)
    assert complete.status_code == 200
    assert complete.get_json()['status'] == 'completed'

    invalid_after_complete = client.post(
        f"/api/assignments/{assignment['id']}/status",
        headers=auth_headers,
        json={'status': 'assigned'},
    )
    assert invalid_after_complete.status_code == 400

    journal_entries = client.get(f"/api/journal/?operation_id={operation['id']}").get_json()
    entry_types = [entry['entry_type'] for entry in journal_entries]
    assert 'assignment_created' in entry_types
    assert 'vehicle_assigned' in entry_types
    assert 'assignment_completed' in entry_types
    assert all(entry['source'] == 'system' for entry in journal_entries)



def test_assignment_upload_pdf_validation(client, auth_headers):
    operation = _create_operation(client, auth_headers)
    assignment = client.post(
        '/api/assignments/',
        headers=auth_headers,
        json={'operation_id': operation['id'], 'title': 'Dokumentation'},
    ).get_json()

    invalid_extension = client.post(
        '/api/assignments/upload',
        headers=auth_headers,
        data={'assignment_id': str(assignment['id']), 'file': (BytesIO(_pdf_bytes()), '../../x.txt', 'application/pdf')},
        content_type='multipart/form-data',
    )
    assert invalid_extension.status_code == 400
    assert invalid_extension.get_json()['error']['code'] == 'invalid_file_type'

    invalid_mime = client.post(
        '/api/assignments/upload',
        headers=auth_headers,
        data={'assignment_id': str(assignment['id']), 'file': (BytesIO(_pdf_bytes()), 'lage.pdf', 'text/plain')},
        content_type='multipart/form-data',
    )
    assert invalid_mime.status_code == 400
    assert invalid_mime.get_json()['error']['code'] == 'invalid_file_type'

    empty_file = client.post(
        '/api/assignments/upload',
        headers=auth_headers,
        data={'assignment_id': str(assignment['id']), 'file': (BytesIO(b''), 'lage.pdf', 'application/pdf')},
        content_type='multipart/form-data',
    )
    assert empty_file.status_code == 400
    assert empty_file.get_json()['error']['code'] == 'invalid_file'

    invalid_pdf = client.post(
        '/api/assignments/upload',
        headers=auth_headers,
        data={'assignment_id': str(assignment['id']), 'file': (BytesIO(b'%PDF-not-a-real-pdf'), 'lage.pdf', 'application/pdf')},
        content_type='multipart/form-data',
    )
    assert invalid_pdf.status_code == 400
    assert invalid_pdf.get_json()['error']['code'] == 'invalid_file'

    client.application.config['MAX_PDF_UPLOAD_SIZE'] = 10
    too_large = client.post(
        '/api/assignments/upload',
        headers=auth_headers,
        data={'assignment_id': str(assignment['id']), 'file': (BytesIO(_pdf_bytes('A' * 200)), 'lage.pdf', 'application/pdf')},
        content_type='multipart/form-data',
    )
    assert too_large.status_code == 413
    assert too_large.get_json()['error']['code'] == 'file_too_large'

    client.application.config['MAX_PDF_UPLOAD_SIZE'] = 8 * 1024 * 1024
    valid = client.post(
        '/api/assignments/upload',
        headers=auth_headers,
        data={'assignment_id': str(assignment['id']), 'file': (BytesIO(_pdf_bytes()), '../lage.pdf', 'application/pdf')},
        content_type='multipart/form-data',
    )
    assert valid.status_code == 200
    assert valid.get_json()['filename'].startswith(assignment['number'])
    assert '..' not in valid.get_json()['filename']
    assert valid.get_json()['filename'].endswith('.pdf')



def test_assignment_requires_active_or_open_operation(client, auth_headers):
    no_operation = client.post('/api/assignments/', headers=auth_headers, json={'title': 'Ohne Lage'})
    assert no_operation.status_code == 400
    assert no_operation.get_json()['error']['code'] == 'no_active_operation'

    operation = _create_operation(client, auth_headers)
    client.post(f"/api/operations/{operation['id']}/close", headers=auth_headers)
    closed = client.post(
        '/api/assignments/',
        headers=auth_headers,
        json={'operation_id': operation['id'], 'title': 'Geschlossen'},
    )
    assert closed.status_code == 400
    assert closed.get_json()['error']['code'] == 'operation_closed'
