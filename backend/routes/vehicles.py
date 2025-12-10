from flask import Blueprint, request, jsonify
from app import db
from models import Vehicle

bp = Blueprint('vehicles', __name__, url_prefix='/api/vehicles')

@bp.route('/', methods=['GET'])
def get_vehicles():
    """Get all vehicles"""
    vehicles = Vehicle.query.all()
    return jsonify([v.to_dict() for v in vehicles])

@bp.route('/', methods=['POST'])
def create_vehicle():
    """Create a new vehicle"""
    data = request.json
    
    vehicle = Vehicle(
        callsign=data.get('callsign'),
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
    vehicle = Vehicle.query.get_or_404(vehicle_id)
    return jsonify(vehicle.to_dict())

@bp.route('/<int:vehicle_id>', methods=['PUT'])
def update_vehicle(vehicle_id):
    """Update a vehicle"""
    vehicle = Vehicle.query.get_or_404(vehicle_id)
    data = request.json
    
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
def delete_vehicle(vehicle_id):
    """Delete a vehicle"""
    vehicle = Vehicle.query.get_or_404(vehicle_id)
    db.session.delete(vehicle)
    db.session.commit()
    return jsonify({'message': 'Vehicle deleted'}), 200

@bp.route('/by-location', methods=['GET'])
def get_vehicles_by_location():
    """Get vehicles grouped by location"""
    vehicles = Vehicle.query.all()
    result = {}
    
    for vehicle in vehicles:
        location_name = vehicle.location.name if vehicle.location else 'Ohne Standort'
        if location_name not in result:
            result[location_name] = []
        result[location_name].append(vehicle.to_dict())
    
    return jsonify(result)
