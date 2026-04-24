import os
import sys
import types
from pathlib import Path

import pytest


if 'geopy' not in sys.modules:
    geopy_module = types.ModuleType('geopy')
    geocoders_module = types.ModuleType('geopy.geocoders')

    class _DummyGeoResult:
        latitude = 50.1109
        longitude = 8.6821

    class _DummyNominatim:
        def __init__(self, *args, **kwargs):
            pass

        def geocode(self, *args, **kwargs):
            if not args or not args[0]:
                return None
            return _DummyGeoResult()

    geocoders_module.Nominatim = _DummyNominatim
    geopy_module.geocoders = geocoders_module
    sys.modules['geopy'] = geopy_module
    sys.modules['geopy.geocoders'] = geocoders_module


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.append(str(BACKEND_ROOT))

from app import create_app, db  # noqa: E402


@pytest.fixture()
def app(tmp_path):
    db_file = tmp_path / 'test.db'
    os.environ['DATABASE_URL'] = f"sqlite:///{db_file}"
    os.environ['INTERNAL_API_KEY'] = 'test-internal-key'
    os.environ['API_KEY'] = 'test-external-key'
    os.environ['FLASK_ENV'] = 'test'

    app = create_app()
    app.config.update(TESTING=True, UPLOAD_FOLDER=str(tmp_path / 'uploads'))

    with app.app_context():
        db.drop_all()
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def auth_headers():
    return {'X-Internal-API-Key': 'test-internal-key'}


@pytest.fixture()
def external_auth_headers():
    return {'X-API-Key': 'test-external-key'}
