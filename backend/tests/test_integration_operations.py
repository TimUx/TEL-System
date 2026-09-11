import pytest

pytestmark = pytest.mark.integration



def test_create_operation_requires_auth(client):
    response = client.post('/api/operations/', json={'title': 'Storm'})
    assert response.status_code == 401
    assert response.get_json()['error']['code'] == 'unauthorized'



def test_operations_crud_flow_and_journal(client, auth_headers):
    create = client.post(
        '/api/operations/',
        headers=auth_headers,
        json={'title': 'Unwetter', 'description': 'Lage Nord'}
    )
    assert create.status_code == 201
    operation = create.get_json()

    duplicate_active = client.post('/api/operations/', headers=auth_headers, json={'title': 'Parallel'})
    assert duplicate_active.status_code == 409
    assert duplicate_active.get_json()['error']['code'] == 'active_operation_exists'

    get_one = client.get(f"/api/operations/{operation['id']}")
    assert get_one.status_code == 200
    assert get_one.get_json()['title'] == 'Unwetter'

    update = client.put(
        f"/api/operations/{operation['id']}",
        headers=auth_headers,
        json={'title': 'Unwetter Updated'}
    )
    assert update.status_code == 200
    assert update.get_json()['title'] == 'Unwetter Updated'

    journal = client.get(f"/api/journal/?operation_id={operation['id']}")
    entries = journal.get_json()
    assert [entry['entry_type'] for entry in entries][:2] == ['operation_created', 'operation_updated']
    assert all(entry['source'] == 'system' for entry in entries)

    close = client.post(f"/api/operations/{operation['id']}/close", headers=auth_headers)
    assert close.status_code == 200
    assert close.get_json()['status'] == 'closed'

    close_again = client.post(f"/api/operations/{operation['id']}/close", headers=auth_headers)
    assert close_again.status_code == 400
    assert close_again.get_json()['error']['code'] == 'operation_closed'

    update_closed = client.put(
        f"/api/operations/{operation['id']}",
        headers=auth_headers,
        json={'title': 'Nope'}
    )
    assert update_closed.status_code == 400
    assert update_closed.get_json()['error']['code'] == 'operation_closed'

    list_resp = client.get('/api/operations/?limit=10&offset=0')
    assert list_resp.status_code == 200
    assert len(list_resp.get_json()) == 1



def test_active_operation_endpoint(client, auth_headers):
    no_active = client.get('/api/operations/active')
    assert no_active.status_code == 200
    assert no_active.get_json() is None

    client.post('/api/operations/', headers=auth_headers, json={'title': 'Active Lage'})
    active = client.get('/api/operations/active')
    assert active.status_code == 200
    assert active.get_json()['status'] == 'active'
