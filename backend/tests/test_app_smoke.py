import os
import sys
import types

import pytest

pytestmark = pytest.mark.integration

sys.path.append(os.path.dirname(os.path.dirname(__file__)))

if 'geopy' not in sys.modules:
    geopy_module = types.ModuleType('geopy')
    geocoders_module = types.ModuleType('geopy.geocoders')

    class _DummyNominatim:
        def __init__(self, *args, **kwargs):
            pass

        def geocode(self, *args, **kwargs):
            return None

    geocoders_module.Nominatim = _DummyNominatim
    geopy_module.geocoders = geocoders_module
    sys.modules['geopy'] = geopy_module
    sys.modules['geopy.geocoders'] = geocoders_module

from app import create_app  # noqa: E402


def test_external_health_endpoint_available():
    app = create_app()
    client = app.test_client()
    response = client.get('/api/external/health')
    assert response.status_code == 200
    assert response.get_json()['status'] == 'ok'


def test_internal_write_protected_when_key_configured():
    os.environ['INTERNAL_API_KEY'] = 'test-key'
    app = create_app()
    client = app.test_client()
    response = client.post('/api/settings/', json={'x': '1'})
    assert response.status_code == 401
    payload = response.get_json()
    assert payload['error']['code'] == 'unauthorized'


def test_versioned_v1_health_alias_available():
    app = create_app()
    client = app.test_client()
    response = client.get('/api/v1/external/health')
    assert response.status_code == 200
