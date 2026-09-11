from flask import Blueprint, jsonify
from sqlalchemy.orm import joinedload

from api_utils import api_error, get_or_api_404, parse_json_body, parse_pagination, require_internal_api_key
from app import db
from models import Assignment, AssignmentStatus, Location, Operation, OperationStatus, Vehicle, VehicleAssignment, VehicleStatus
from services.journal_service import create_system_event


bp = Blueprint('vehicles', __name__, url_prefix='/api/vehicles')



def _vehicles_query():
    return Vehicle.query.options(joinedload(Vehicle.location))



def _active_operation():
    return Operation.query.filter_by(status=OperationStatus.ACTIVE).first()


@bp.route('/', methods=['GET'])
def get_vehicles():
    limit, offset, error = parse_pagination()
    if error:
        return error
    vehicles = _vehicles_query().order_by(Vehicle.callsign).limit(limit).offset(offset).all()
    return jsonify([vehicle.to_dict() for vehicle in vehicles])


@bp.route('/', methods=['POST'])
@require_internal_api_key
def create_vehicle():
    data, error = parse_json_body(required_fields=['callsign'])
    if error:
        return error

    try:
        status = VehicleStatus(data.get('status', VehicleStatus.AVAILABLE.value))
    except ValueError:
        return api_error('Invalid vehicle status', 400, 'validation_error')
    location_id = data.get('location_id')
    if location_id:
        location, location_error = get_or_api_404(Location, location_id, 'location')
        if location_error:
            return location_error
    else:
        location = None

    vehicle = Vehicle(
        callsign=data['callsign'],
        vehicle_type=data.get('vehicle_type'),
        crew_count=data.get('crew_count', 0),
        location_id=location.id if location else None,
        status=status,
        notes=data.get('notes'),
    )

    db.session.add(vehicle)
    db.session.commit()
    return jsonify(_vehicles_query().filter_by(id=vehicle.id).first().to_dict()), 201


@bp.route('/<int:vehicle_id>', methods=['GET'])
def get_vehicle(vehicle_id):
    vehicle = _vehicles_query().filter_by(id=vehicle_id).first()
    if not vehicle:
        return api_error('vehicle not found', 404, 'not_found')
    return jsonify(vehicle.to_dict())


@bp.route('/<int:vehicle_id>', methods=['PUT'])
@require_internal_api_key
def update_vehicle(vehicle_id):
    vehicle, error = get_or_api_404(Vehicle, vehicle_id, 'vehicle')
    if error:
        return error
    data, error = parse_json_body()
    if error:
        return error

    if 'location_id' in data and data['location_id']:
        location, location_error = get_or_api_404(Location, data['location_id'], 'location')
        if location_error:
            return location_error
        vehicle.location_id = location.id
    elif 'location_id' in data:
        vehicle.location_id = None

    previous_status = vehicle.status
    if 'callsign' in data:
        vehicle.callsign = data['callsign']
    if 'vehicle_type' in data:
        vehicle.vehicle_type = data['vehicle_type']
    if 'crew_count' in data:
        vehicle.crew_count = data['crew_count']
    if 'notes' in data:
        vehicle.notes = data['notes']
    if 'status' in data:
        try:
            vehicle.status = VehicleStatus(data['status'])
        except ValueError:
            return api_error('Invalid vehicle status', 400, 'validation_error')

    active_operation = _active_operation()
    if previous_status != vehicle.status and active_operation:
        db.session.add(create_system_event(
            active_operation.id,
            f'Fahrzeug {vehicle.callsign}: Status geändert: {previous_status.value} → {vehicle.status.value}',
            entry_type='vehicle_status_changed',
        ))

    db.session.commit()
    return jsonify(_vehicles_query().filter_by(id=vehicle.id).first().to_dict())


@bp.route('/<int:vehicle_id>', methods=['DELETE'])
@require_internal_api_key
def delete_vehicle(vehicle_id):
    vehicle, error = get_or_api_404(Vehicle, vehicle_id, 'vehicle')
    if error:
        return error

    has_active_assignments = (
        VehicleAssignment.query.join(Assignment)
        .filter(
            VehicleAssignment.vehicle_id == vehicle.id,
            Assignment.status != AssignmentStatus.COMPLETED,
        )
        .count()
    )
    if has_active_assignments:
        return api_error('Cannot delete vehicle with active assignments', 400, 'vehicle_in_use')

    db.session.delete(vehicle)
    db.session.commit()
    return jsonify({'message': 'Vehicle deleted'}), 200


@bp.route('/by-location', methods=['GET'])
def get_vehicles_by_location():
    limit, offset, error = parse_pagination()
    if error:
        return error
    vehicles = _vehicles_query().order_by(Vehicle.callsign).limit(limit).offset(offset).all()
    result = {}
    for vehicle in vehicles:
        location_name = vehicle.location.name if vehicle.location else 'Ohne Standort'
        result.setdefault(location_name, []).append(vehicle.to_dict())
    return jsonify(result)
