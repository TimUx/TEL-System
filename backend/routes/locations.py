from flask import Blueprint, current_app, jsonify

from api_utils import get_or_api_404, log_exception, parse_json_body, parse_pagination, require_internal_api_key
from app import db
from models import Location
from services.geocoding_service import schedule_location_geocoding


bp = Blueprint('locations', __name__, url_prefix='/api/locations')


@bp.route('/', methods=['GET'])
def get_locations():
    limit, offset, error = parse_pagination()
    if error:
        return error
    locations = Location.query.order_by(Location.name).limit(limit).offset(offset).all()
    return jsonify([loc.to_dict() for loc in locations])


@bp.route('/', methods=['POST'])
@require_internal_api_key
def create_location():
    data, error = parse_json_body(required_fields=['name', 'address'])
    if error:
        return error

    try:
        location = Location(name=data['name'], address=data['address'])
        if data.get('latitude') is not None and data.get('longitude') is not None:
            location.latitude = data['latitude']
            location.longitude = data['longitude']
        db.session.add(location)
        db.session.commit()
        if location.latitude is None and location.longitude is None:
            schedule_location_geocoding(current_app._get_current_object(), location.id, location.address)
        return jsonify(location.to_dict()), 201
    except Exception as error:
        db.session.rollback()
        log_exception('create_location failed', error)
        raise


@bp.route('/<int:location_id>', methods=['GET'])
def get_location(location_id):
    location, error = get_or_api_404(Location, location_id, 'location')
    if error:
        return error
    return jsonify(location.to_dict())


@bp.route('/<int:location_id>', methods=['PUT'])
@require_internal_api_key
def update_location(location_id):
    location, error = get_or_api_404(Location, location_id, 'location')
    if error:
        return error
    data, error = parse_json_body()
    if error:
        return error

    if 'name' in data:
        location.name = data['name']
    geocode_address = None
    if 'address' in data:
        location.address = data['address']
        geocode_address = data['address']
    if 'latitude' in data:
        location.latitude = data['latitude']
    if 'longitude' in data:
        location.longitude = data['longitude']

    db.session.commit()
    if geocode_address and data.get('latitude') is None and data.get('longitude') is None:
        location.latitude = None
        location.longitude = None
        db.session.commit()
        schedule_location_geocoding(current_app._get_current_object(), location.id, geocode_address)
    return jsonify(location.to_dict())


@bp.route('/<int:location_id>', methods=['DELETE'])
@require_internal_api_key
def delete_location(location_id):
    location, error = get_or_api_404(Location, location_id, 'location')
    if error:
        return error
    db.session.delete(location)
    db.session.commit()
    return jsonify({'message': 'Location deleted'}), 200
