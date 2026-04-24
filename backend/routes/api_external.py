from flask import Blueprint, request, jsonify
from functools import wraps
import os
from api_utils import api_error

bp = Blueprint('api_external', __name__, url_prefix='/api/external')

# Simple API key authentication
def require_api_key(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('X-API-Key')
        expected_key = os.environ.get('API_KEY')
        if not expected_key:
            return api_error('External API key is not configured', 503, 'service_unavailable')
        
        if not api_key or api_key != expected_key:
            return api_error('Invalid or missing API key', 401, 'unauthorized')
        
        return f(*args, **kwargs)
    return decorated_function

@bp.route('/assignments', methods=['POST'])
@require_api_key
def create_assignment_external():
    """Create assignment via external API"""
    from routes.assignments import create_assignment
    return create_assignment()

@bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'ok'}), 200
