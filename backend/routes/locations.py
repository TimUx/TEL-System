from flask import Blueprint, request, jsonify
from app import db
from models import Location
from geopy.geocoders import Nominatim

bp = Blueprint('locations', __name__, url_prefix='/api/locations')

# Initialize geocoder
geolocator = Nominatim(user_agent="tel-system")

@bp.route('/', methods=['GET'])
def get_locations():
    """Get all locations"""
    locations = Location.query.all()
    return jsonify([loc.to_dict() for loc in locations])

@bp.route('/', methods=['POST'])
def create_location():
    """Create a new location"""
    data = request.json
    
    location = Location(
        name=data.get('name'),
        address=data.get('address')
    )
    
    # Try to geocode the address
    try:
        geo_result = geolocator.geocode(data.get('address'))
        if geo_result:
            location.latitude = geo_result.latitude
            location.longitude = geo_result.longitude
    except Exception as e:
        print(f"Geocoding error: {e}")
    
    db.session.add(location)
    db.session.commit()
    
    return jsonify(location.to_dict()), 201

@bp.route('/<int:location_id>', methods=['GET'])
def get_location(location_id):
    """Get a single location"""
    location = Location.query.get_or_404(location_id)
    return jsonify(location.to_dict())

@bp.route('/<int:location_id>', methods=['PUT'])
def update_location(location_id):
    """Update a location"""
    location = Location.query.get_or_404(location_id)
    data = request.json
    
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
            print(f"Geocoding error: {e}")
    
    db.session.commit()
    return jsonify(location.to_dict())

@bp.route('/<int:location_id>', methods=['DELETE'])
def delete_location(location_id):
    """Delete a location"""
    location = Location.query.get_or_404(location_id)
    db.session.delete(location)
    db.session.commit()
    return jsonify({'message': 'Location deleted'}), 200
