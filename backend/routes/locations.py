from flask import Blueprint, request, jsonify
from app import db
from models import Location
from geopy.geocoders import Nominatim
from api_utils import parse_json_body, parse_pagination, require_internal_api_key, log_exception, get_or_api_404

bp = Blueprint('locations', __name__, url_prefix='/api/locations')

# Initialize geocoder
geolocator = Nominatim(user_agent="tel-system")

@bp.route('/', methods=['GET'])
def get_locations():
    """Get all locations"""
    limit, offset, error = parse_pagination()
    if error:
        return error
    locations = Location.query.limit(limit).offset(offset).all()
    return jsonify([loc.to_dict() for loc in locations])

@bp.route('/', methods=['POST'])
@require_internal_api_key
def create_location():
    """Create a new location"""
    data, error = parse_json_body(required_fields=['name', 'address'])
    if error:
        return error
    
    location = Location(
        name=data['name'],
        address=data['address']
    )
    
    # Try to geocode the address
    try:
        geo_result = geolocator.geocode(data['address'])
        if geo_result:
            location.latitude = geo_result.latitude
            location.longitude = geo_result.longitude
    except Exception as e:
        log_exception('location geocoding failed', e)
    
    db.session.add(location)
    db.session.commit()
    
    return jsonify(location.to_dict()), 201

@bp.route('/<int:location_id>', methods=['GET'])
def get_location(location_id):
    """Get a single location"""
    location, error = get_or_api_404(Location, location_id, 'location')
    if error:
        return error
    return jsonify(location.to_dict())

@bp.route('/<int:location_id>', methods=['PUT'])
@require_internal_api_key
def update_location(location_id):
    """Update a location"""
    location, error = get_or_api_404(Location, location_id, 'location')
    if error:
        return error
    data, error = parse_json_body()
    if error:
        return error
    
    if 'name' in data:
        location.name = data['name']
    if 'address' in data:
        location.address = data['address']
        # Re-geocode if address changed
        try:
            geo_result = geolocator.geocode(data['address'])
            if geo_result:
                location.latitude = geo_result.latitude
                location.longitude = geo_result.longitude
        except Exception as e:
            log_exception('location re-geocoding failed', e)
    
    db.session.commit()
    return jsonify(location.to_dict())

@bp.route('/<int:location_id>', methods=['DELETE'])
@require_internal_api_key
def delete_location(location_id):
    """Delete a location"""
    location, error = get_or_api_404(Location, location_id, 'location')
    if error:
        return error
    db.session.delete(location)
    db.session.commit()
    return jsonify({'message': 'Location deleted'}), 200
