import pytest
from flask import Flask

from api_utils import api_error

pytestmark = pytest.mark.unit


def test_api_error_payload_shape():
    app = Flask(__name__)
    with app.app_context():
        response, status = api_error(
            'Validation failed',
            400,
            'validation_error',
            {'missing_fields': ['title']}
        )
        payload = response.get_json()

    assert status == 400
    assert payload['error']['code'] == 'validation_error'
    assert payload['error']['message'] == 'Validation failed'
    assert payload['error']['details']['missing_fields'] == ['title']
