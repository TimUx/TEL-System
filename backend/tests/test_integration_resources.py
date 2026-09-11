import pytest

pytestmark = pytest.mark.integration



def test_locations_vehicles_settings_and_journal_flow(client, auth_headers):
    op = client.post('/api/operations/', headers=auth_headers, json={'title': 'Lage Ressourcen'}).get_json()

    location = client.post(
        '/api/locations/',
        headers=auth_headers,
        json={'name': 'Wache Mitte', 'address': 'Musterstraße 1, Frankfurt'},
    )
    assert location.status_code == 201
    location_id = location.get_json()['id']

    vehicle = client.post(
        '/api/vehicles/',
        headers=auth_headers,
        json={'callsign': 'FL-M-11', 'vehicle_type': 'HLF', 'crew_count': 6, 'location_id': location_id, 'status': 'unavailable'},
    )
    assert vehicle.status_code == 201
    vehicle_id = vehicle.get_json()['id']
    assert vehicle.get_json()['status'] == 'unavailable'

    vehicle_update = client.put(
        f'/api/vehicles/{vehicle_id}',
        headers=auth_headers,
        json={'status': 'available'},
    )
    assert vehicle_update.status_code == 200
    assert vehicle_update.get_json()['status'] == 'available'

    grouped = client.get('/api/vehicles/by-location?limit=20&offset=0')
    assert grouped.status_code == 200
    assert any('Wache' in key for key in grouped.get_json().keys())

    settings = client.post('/api/settings/', headers=auth_headers, json={'mail.host': 'imap.local'})
    assert settings.status_code == 200

    settings_get = client.get('/api/settings/mail.host')
    assert settings_get.status_code == 200
    assert settings_get.get_json()['value'] == 'imap.local'

    user_journal = client.post(
        '/api/journal/',
        headers=auth_headers,
        json={'operation_id': op['id'], 'content': 'Lage gestartet', 'entry_type': 'note'},
    )
    assert user_journal.status_code == 201
    journal_id = user_journal.get_json()['id']
    assert user_journal.get_json()['source'] == 'user'

    journal_update = client.put(
        f'/api/journal/{journal_id}',
        headers=auth_headers,
        json={'content': 'Lage gestartet - aktualisiert'},
    )
    assert journal_update.status_code == 200

    journal_list = client.get(f"/api/journal/?operation_id={op['id']}&limit=20&offset=0")
    assert journal_list.status_code == 200
    entries = journal_list.get_json()
    assert len(entries) >= 2
    assert entries == sorted(entries, key=lambda entry: (entry['timestamp'], entry['id']))

    system_entry_id = next(entry['id'] for entry in entries if entry['source'] == 'system')
    system_update = client.put(
        f'/api/journal/{system_entry_id}',
        headers=auth_headers,
        json={'content': 'forbidden'},
    )
    assert system_update.status_code == 400
    assert system_update.get_json()['error']['code'] == 'system_entry_locked'

    journal_delete = client.delete(f'/api/journal/{journal_id}', headers=auth_headers)
    assert journal_delete.status_code == 200

    vehicle_delete = client.delete(f'/api/vehicles/{vehicle_id}', headers=auth_headers)
    assert vehicle_delete.status_code == 200

    location_delete = client.delete(f'/api/locations/{location_id}', headers=auth_headers)
    assert location_delete.status_code == 200



def test_external_api_assignment_creation(client, external_auth_headers, auth_headers):
    op = client.post('/api/operations/', headers=auth_headers, json={'title': 'Lage External'}).get_json()

    created = client.post(
        '/api/external/assignments',
        headers=external_auth_headers,
        json={'operation_id': op['id'], 'title': 'Extern gemeldet'},
    )
    assert created.status_code == 201
    assert created.get_json()['title'] == 'Extern gemeldet'



def test_pagination_validation(client, auth_headers):
    client.post('/api/operations/', headers=auth_headers, json={'title': 'Pagination Lage'})
    invalid = client.get('/api/operations/?limit=abc&offset=0')
    assert invalid.status_code == 400
    assert invalid.get_json()['error']['code'] == 'invalid_pagination'

    boundary = client.get('/api/operations/?limit=1&offset=0')
    assert boundary.status_code == 200
    assert len(boundary.get_json()) == 1
