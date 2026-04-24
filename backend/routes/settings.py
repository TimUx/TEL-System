from flask import Blueprint, request, jsonify
from app import db
from models import Settings
from api_utils import parse_json_body, require_internal_api_key, api_error

bp = Blueprint('settings', __name__, url_prefix='/api/settings')

@bp.route('/', methods=['GET'])
def get_settings():
    """Get all settings"""
    settings = Settings.query.all()
    return jsonify({s.key: s.value for s in settings})

@bp.route('/<key>', methods=['GET'])
def get_setting(key):
    """Get a single setting"""
    setting = Settings.query.filter_by(key=key).first()
    if setting:
        return jsonify(setting.to_dict())
    return api_error('Setting not found', 404, 'not_found')

@bp.route('/', methods=['POST'])
@require_internal_api_key
def update_settings():
    """Update settings"""
    data, error = parse_json_body()
    if error:
        return error
    
    for key, value in data.items():
        setting = Settings.query.filter_by(key=key).first()
        if setting:
            setting.value = value
        else:
            setting = Settings(key=key, value=value)
            db.session.add(setting)
    
    db.session.commit()
    return jsonify({'message': 'Settings updated'}), 200
