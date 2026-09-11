import logging
import os
from functools import wraps

from flask import jsonify, request



logger = logging.getLogger(__name__)


def api_error(message, status_code=400, code='bad_request', details=None):
    payload = {
        'error': {
            'code': code,
            'message': message,
        }
    }
    if details is not None:
        payload['error']['details'] = details
    return jsonify(payload), status_code


def parse_json_body(required_fields=None):
    data = request.get_json(silent=True)
    if data is None:
        return None, api_error('Request body must be valid JSON', 400, 'invalid_json')

    if required_fields:
        missing = [field for field in required_fields if field not in data or data[field] in (None, '')]
        if missing:
            return None, api_error(
                'Missing required fields',
                400,
                'validation_error',
                {'missing_fields': missing},
            )

    return data, None


def parse_pagination(default_limit=100, max_limit=500):
    try:
        limit = int(request.args.get('limit', default_limit))
        offset = int(request.args.get('offset', 0))
    except ValueError:
        return None, None, api_error('limit and offset must be integers', 400, 'invalid_pagination')

    if limit < 1 or limit > max_limit:
        return None, None, api_error(f'limit must be between 1 and {max_limit}', 400, 'invalid_pagination')
    if offset < 0:
        return None, None, api_error('offset must be >= 0', 400, 'invalid_pagination')

    return limit, offset, None


def require_internal_api_key(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if request.path.startswith('/api/external') or request.path.startswith('/api/v1/external'):
            return f(*args, **kwargs)

        expected_key = os.environ.get('INTERNAL_API_KEY')
        if not expected_key:
            return api_error('Internal API key is not configured', 503, 'service_unavailable')

        provided_key = request.headers.get('X-Internal-API-Key')
        if not provided_key or provided_key != expected_key:
            return api_error('Invalid or missing internal API key', 401, 'unauthorized')

        return f(*args, **kwargs)

    return decorated


def log_exception(context, error):
    logger.exception('%s: %s', context, error)


def get_or_api_404(model, object_id, resource_name='resource'):
    obj = model.query.session.get(model, object_id)
    if not obj:
        return None, api_error(f'{resource_name} not found', 404, 'not_found')
    return obj, None
