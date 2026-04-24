import pytest

pytestmark = pytest.mark.integration

def test_create_operation_requires_auth(client):
    response = client.post('/api/operations/', json={'title': 'Storm'})
    assert response.status_code == 401
    assert response.get_json()['error']['code'] == 'unauthorized'


def test_operations_crud_flow(client, auth_headers):
    create = client.post(
        '/api/operations/',
        headers=auth_headers,
        json={'title': 'Unwetter', 'description': 'Lage Nord'}
    )
    assert create.status_code == 201
    operation = create.get_json()

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

    close = client.post(f"/api/operations/{operation['id']}/close", headers=auth_headers)
    assert close.status_code == 200
    assert close.get_json()['status'] == 'closed'

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
