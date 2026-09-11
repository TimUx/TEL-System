import os
import sys
import types
from pathlib import Path

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


@pytest.fixture()
def isolated_env(tmp_path, monkeypatch):
    db_file = tmp_path / 'smoke.db'
    monkeypatch.setenv('DATABASE_URL', f'sqlite:///{db_file}')
    monkeypatch.setenv('INTERNAL_API_KEY', 'test-key')
    monkeypatch.setenv('API_KEY', 'external-key')
    monkeypatch.setenv('FLASK_ENV', 'test')
    monkeypatch.setenv('UPLOAD_FOLDER', str(tmp_path / 'uploads'))
    return tmp_path


def test_external_health_endpoint_available(isolated_env):
    app = create_app()
    client = app.test_client()
    response = client.get('/api/external/health')
    assert response.status_code == 200
    assert response.get_json()['status'] == 'ok'


def test_internal_write_requires_key_header(isolated_env):
    app = create_app()
    client = app.test_client()
    response = client.post('/api/settings/', json={'x': '1'})
    assert response.status_code == 401
    assert response.get_json()['error']['code'] == 'unauthorized'


def test_internal_write_returns_503_when_key_missing(tmp_path, monkeypatch):
    db_file = tmp_path / 'missing-key.db'
    monkeypatch.setenv('DATABASE_URL', f'sqlite:///{db_file}')
    monkeypatch.delenv('INTERNAL_API_KEY', raising=False)
    monkeypatch.setenv('API_KEY', 'external-key')
    monkeypatch.setenv('FLASK_ENV', 'test')
    app = create_app()
    client = app.test_client()
    response = client.post('/api/settings/', json={'x': '1'})
    assert response.status_code == 503
    assert response.get_json()['error']['code'] == 'service_unavailable'


def test_external_write_returns_503_when_key_missing(tmp_path, monkeypatch):
    db_file = tmp_path / 'missing-external.db'
    monkeypatch.setenv('DATABASE_URL', f'sqlite:///{db_file}')
    monkeypatch.setenv('INTERNAL_API_KEY', 'internal-key')
    monkeypatch.delenv('API_KEY', raising=False)
    monkeypatch.setenv('FLASK_ENV', 'test')
    app = create_app()
    client = app.test_client()
    response = client.post('/api/external/assignments', json={'title': 'Missing key'})
    assert response.status_code == 503
    assert response.get_json()['error']['code'] == 'service_unavailable'


def test_versioned_v1_health_alias_available(isolated_env):
    app = create_app()
    client = app.test_client()
    response = client.get('/api/v1/external/health')
    assert response.status_code == 200


def test_api_unknown_route_returns_json_404(isolated_env):
    app = create_app()
    client = app.test_client()
    response = client.get('/api/does-not-exist')
    assert response.status_code == 404
    assert response.get_json()['error']['code'] == 'not_found'


def test_production_requires_non_default_secrets(tmp_path, monkeypatch):
    db_file = tmp_path / 'production.db'
    monkeypatch.setenv('DATABASE_URL', f'sqlite:///{db_file}')
    monkeypatch.setenv('FLASK_ENV', 'production')
    monkeypatch.setenv('SECRET_KEY', 'change-this-in-production')
    monkeypatch.setenv('API_KEY', 'change-this-in-production')
    monkeypatch.setenv('INTERNAL_API_KEY', 'change-this-in-production')

    with pytest.raises(RuntimeError):
        create_app()
