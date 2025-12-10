from flask import Blueprint, request, jsonify
from app import db
from models import Settings

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
    return jsonify(None)

@bp.route('/', methods=['POST'])
def update_settings():
    """Update settings"""
    data = request.json
    
    for key, value in data.items():
        setting = Settings.query.filter_by(key=key).first()
        if setting:
            setting.value = value
        else:
            setting = Settings(key=key, value=value)
            db.session.add(setting)
    
    db.session.commit()
    return jsonify({'message': 'Settings updated'}), 200
