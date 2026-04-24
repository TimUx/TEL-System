from io import BytesIO
import pytest

pytestmark = pytest.mark.integration


def _create_operation(client, auth_headers):
    response = client.post('/api/operations/', headers=auth_headers, json={'title': 'Lage A'})
    return response.get_json()


def _create_vehicle(client, auth_headers, callsign='FL-1'):
    response = client.post('/api/vehicles/', headers=auth_headers, json={'callsign': callsign, 'crew_count': 3})
    return response.get_json()


def test_assignment_create_update_complete_and_vehicle_flow(client, auth_headers):
    operation = _create_operation(client, auth_headers)
    vehicle = _create_vehicle(client, auth_headers)

    created = client.post(
        '/api/assignments/',
        headers=auth_headers,
        json={
            'operation_id': operation['id'],
            'title': 'Baum auf Straße',
            'location_address': 'Mainzer Landstraße 1'
        }
    )
    assert created.status_code == 201
    assignment = created.get_json()
    assert assignment['number'].endswith('-001')

    fetched = client.get(f"/api/assignments/{assignment['id']}")
    assert fetched.status_code == 200

    updated = client.put(
        f"/api/assignments/{assignment['id']}",
        headers=auth_headers,
        json={'description': 'Dringend', 'latitude': 50.2, 'longitude': 8.7}
    )
    assert updated.status_code == 200
    assert updated.get_json()['description'] == 'Dringend'

    assign_vehicle = client.post(
        f"/api/assignments/{assignment['id']}/vehicles",
        headers=auth_headers,
        json={'vehicle_id': vehicle['id']}
    )
    assert assign_vehicle.status_code == 200
    assert assign_vehicle.get_json()['status'] == 'assigned'

    unassign_vehicle = client.delete(
        f"/api/assignments/{assignment['id']}/vehicles/{vehicle['id']}",
        headers=auth_headers
    )
    assert unassign_vehicle.status_code == 200

    complete = client.post(f"/api/assignments/{assignment['id']}/complete", headers=auth_headers)
    assert complete.status_code == 200
    assert complete.get_json()['status'] == 'completed'


def test_assignment_upload_pdf_validation(client, auth_headers):
    operation = _create_operation(client, auth_headers)
    assignment_resp = client.post(
        '/api/assignments/',
        headers=auth_headers,
        json={'operation_id': operation['id'], 'title': 'Dokumentation'}
    )
    assignment = assignment_resp.get_json()

    invalid = client.post(
        '/api/assignments/upload',
        headers=auth_headers,
        data={'assignment_id': str(assignment['id']), 'file': (BytesIO(b'hello'), 'x.txt')},
        content_type='multipart/form-data'
    )
    assert invalid.status_code == 400
    assert invalid.get_json()['error']['code'] == 'invalid_file_type'

    valid = client.post(
        '/api/assignments/upload',
        headers=auth_headers,
        data={'assignment_id': str(assignment['id']), 'file': (BytesIO(b'%PDF-1.4 test'), 'lage.pdf', 'application/pdf')},
        content_type='multipart/form-data'
    )
    assert valid.status_code == 200
    assert valid.get_json()['filename'].endswith('lage.pdf')
