from flask import Blueprint, request, jsonify
from app import db
from models import Vehicle
from api_utils import parse_json_body, parse_pagination, require_internal_api_key, get_or_api_404

bp = Blueprint('vehicles', __name__, url_prefix='/api/vehicles')

@bp.route('/', methods=['GET'])
def get_vehicles():
    """Get all vehicles"""
    limit, offset, error = parse_pagination()
    if error:
        return error
    vehicles = Vehicle.query.limit(limit).offset(offset).all()
    return jsonify([v.to_dict() for v in vehicles])

@bp.route('/', methods=['POST'])
@require_internal_api_key
def create_vehicle():
    """Create a new vehicle"""
    data, error = parse_json_body(required_fields=['callsign'])
    if error:
        return error
    
    vehicle = Vehicle(
        callsign=data['callsign'],
        vehicle_type=data.get('vehicle_type'),
        crew_count=data.get('crew_count', 0),
        location_id=data.get('location_id'),
        notes=data.get('notes')
    )
    
    db.session.add(vehicle)
    db.session.commit()
    
    return jsonify(vehicle.to_dict()), 201

@bp.route('/<int:vehicle_id>', methods=['GET'])
def get_vehicle(vehicle_id):
    """Get a single vehicle"""
    vehicle, error = get_or_api_404(Vehicle, vehicle_id, 'vehicle')
    if error:
        return error
    return jsonify(vehicle.to_dict())

@bp.route('/<int:vehicle_id>', methods=['PUT'])
@require_internal_api_key
def update_vehicle(vehicle_id):
    """Update a vehicle"""
    vehicle, error = get_or_api_404(Vehicle, vehicle_id, 'vehicle')
    if error:
        return error
    data, error = parse_json_body()
    if error:
        return error
    
    if 'callsign' in data:
        vehicle.callsign = data['callsign']
    if 'vehicle_type' in data:
        vehicle.vehicle_type = data['vehicle_type']
    if 'crew_count' in data:
        vehicle.crew_count = data['crew_count']
    if 'location_id' in data:
        vehicle.location_id = data['location_id']
    if 'notes' in data:
        vehicle.notes = data['notes']
    
    db.session.commit()
    return jsonify(vehicle.to_dict())

@bp.route('/<int:vehicle_id>', methods=['DELETE'])
@require_internal_api_key
def delete_vehicle(vehicle_id):
    """Delete a vehicle"""
    vehicle, error = get_or_api_404(Vehicle, vehicle_id, 'vehicle')
    if error:
        return error
    db.session.delete(vehicle)
    db.session.commit()
    return jsonify({'message': 'Vehicle deleted'}), 200

@bp.route('/by-location', methods=['GET'])
def get_vehicles_by_location():
    """Get vehicles grouped by location"""
    limit, offset, error = parse_pagination()
    if error:
        return error
    vehicles = Vehicle.query.limit(limit).offset(offset).all()
    result = {}
    
    for vehicle in vehicles:
        location_name = vehicle.location.name if vehicle.location else 'Ohne Standort'
        if location_name not in result:
            result[location_name] = []
        result[location_name].append(vehicle.to_dict())
    
    return jsonify(result)
