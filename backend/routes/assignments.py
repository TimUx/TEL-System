from flask import Blueprint, request, jsonify, current_app
from app import db
from models import Assignment, Operation, VehicleAssignment, Vehicle, JournalEntry, AssignmentStatus, OperationStatus
from datetime import datetime
from geopy.geocoders import Nominatim
from sqlalchemy import desc
from sqlalchemy.exc import IntegrityError
import os
from werkzeug.utils import secure_filename
from api_utils import parse_json_body, parse_pagination, require_internal_api_key, log_exception, api_error, get_or_api_404
from services.assignment_service import next_assignment_number

bp = Blueprint('assignments', __name__, url_prefix='/api/assignments')
geolocator = Nominatim(user_agent="tel-system")

@bp.route('/', methods=['GET'])
def get_assignments():
    """Get all assignments for active operation"""
    operation_id = request.args.get('operation_id')
    limit, offset, error = parse_pagination()
    if error:
        return error
    
    if operation_id:
        assignments = Assignment.query.filter_by(operation_id=operation_id).order_by(desc(Assignment.number)).limit(limit).offset(offset).all()
    else:
        # Get active operation
        operation = Operation.query.filter_by(status=OperationStatus.ACTIVE).first()
        if operation:
            assignments = Assignment.query.filter_by(operation_id=operation.id).order_by(desc(Assignment.number)).limit(limit).offset(offset).all()
        else:
            assignments = []
    
    return jsonify([a.to_dict() for a in assignments])

@bp.route('/', methods=['POST'])
@require_internal_api_key
def create_assignment():
    """Create a new assignment"""
    data, error = parse_json_body(required_fields=['title'])
    if error:
        return error
    
    # Get or create active operation
    operation_id = data.get('operation_id')
    if not operation_id:
        operation = Operation.query.filter_by(status=OperationStatus.ACTIVE).first()
        if not operation:
            return api_error('No active operation found', 400, 'no_active_operation')
        operation_id = operation.id
    
    operation = Operation.query.get(operation_id)
    if not operation:
        return api_error('Operation not found', 404, 'operation_not_found')

    for _ in range(3):
        try:
            assignment_number = next_assignment_number(operation_id, operation.number)

            assignment = Assignment(
                operation_id=operation_id,
                number=assignment_number,
                title=data['title'],
                description=data.get('description'),
                location_address=data.get('location_address'),
                status=AssignmentStatus.OPEN
            )

            if 'latitude' in data and 'longitude' in data:
                assignment.latitude = data['latitude']
                assignment.longitude = data['longitude']
            elif data.get('location_address'):
                try:
                    geo_result = geolocator.geocode(data['location_address'])
                    if geo_result:
                        assignment.latitude = geo_result.latitude
                        assignment.longitude = geo_result.longitude
                except Exception as e:
                    log_exception('assignment geocoding failed', e)

            db.session.add(assignment)
            db.session.flush()

            journal_entry = JournalEntry(
                operation_id=operation_id,
                assignment_id=assignment.id,
                entry_type='status_change',
                content=f'Auftrag {assignment.number} erstellt: {assignment.title}'
            )
            db.session.add(journal_entry)
            db.session.commit()
            return jsonify(assignment.to_dict()), 201
        except IntegrityError:
            db.session.rollback()
            continue
        except Exception as e:
            db.session.rollback()
            log_exception('create_assignment failed', e)
            return api_error('Failed to create assignment', 500, 'assignment_create_failed')

    return api_error('Failed to allocate assignment number. Please retry.', 409, 'assignment_number_conflict')

@bp.route('/<int:assignment_id>', methods=['GET'])
def get_assignment(assignment_id):
    """Get a single assignment"""
    assignment, error = get_or_api_404(Assignment, assignment_id, 'assignment')
    if error:
        return error
    return jsonify(assignment.to_dict())

@bp.route('/<int:assignment_id>', methods=['PUT'])
@require_internal_api_key
def update_assignment(assignment_id):
    """Update an assignment"""
    assignment, obj_error = get_or_api_404(Assignment, assignment_id, 'assignment')
    if obj_error:
        return obj_error
    
    # Check if operation is closed
    if assignment.operation.status == OperationStatus.CLOSED:
        return api_error('Cannot modify assignment in closed operation', 400, 'operation_closed')
    
    data, error = parse_json_body()
    if error:
        return error
    
    if 'title' in data:
        assignment.title = data['title']
    if 'description' in data:
        assignment.description = data['description']
    if 'location_address' in data:
        assignment.location_address = data['location_address']
        # Re-geocode
        try:
            geo_result = geolocator.geocode(data['location_address'])
            if geo_result:
                assignment.latitude = geo_result.latitude
                assignment.longitude = geo_result.longitude
        except Exception as e:
            log_exception('assignment re-geocoding failed', e)
    if 'latitude' in data:
        assignment.latitude = data['latitude']
    if 'longitude' in data:
        assignment.longitude = data['longitude']
    
    db.session.commit()
    return jsonify(assignment.to_dict())

@bp.route('/<int:assignment_id>/complete', methods=['POST'])
@require_internal_api_key
def complete_assignment(assignment_id):
    """Mark an assignment as completed"""
    assignment, error = get_or_api_404(Assignment, assignment_id, 'assignment')
    if error:
        return error
    
    if assignment.operation.status == OperationStatus.CLOSED:
        return api_error('Cannot modify assignment in closed operation', 400, 'operation_closed')
    
    assignment.status = AssignmentStatus.COMPLETED
    assignment.completed_at = datetime.utcnow()
    
    # Create journal entry
    journal_entry = JournalEntry(
        operation_id=assignment.operation_id,
        assignment_id=assignment.id,
        entry_type='status_change',
        content=f'Auftrag {assignment.number} abgeschlossen'
    )
    db.session.add(journal_entry)
    db.session.commit()
    
    return jsonify(assignment.to_dict())

@bp.route('/<int:assignment_id>/vehicles', methods=['POST'])
@require_internal_api_key
def assign_vehicle(assignment_id):
    """Assign a vehicle to an assignment"""
    assignment, assignment_error = get_or_api_404(Assignment, assignment_id, 'assignment')
    if assignment_error:
        return assignment_error
    data, error = parse_json_body(required_fields=['vehicle_id'])
    if error:
        return error
    vehicle_id = data.get('vehicle_id')
    
    vehicle, vehicle_error = get_or_api_404(Vehicle, vehicle_id, 'vehicle')
    if vehicle_error:
        return vehicle_error
    
    # Check if vehicle is already assigned to this assignment
    existing = VehicleAssignment.query.filter_by(
        vehicle_id=vehicle_id,
        assignment_id=assignment_id
    ).first()
    
    if existing:
        return api_error('Vehicle already assigned to this assignment', 400, 'vehicle_already_assigned')
    
    # Get the max order for this vehicle
    max_order = db.session.query(db.func.max(VehicleAssignment.order)).filter_by(
        vehicle_id=vehicle_id
    ).scalar() or 0
    
    vehicle_assignment = VehicleAssignment(
        vehicle_id=vehicle_id,
        assignment_id=assignment_id,
        order=max_order + 1
    )
    
    db.session.add(vehicle_assignment)
    
    # Update assignment status if it was open
    if assignment.status == AssignmentStatus.OPEN:
        assignment.status = AssignmentStatus.ASSIGNED
    
    # Create journal entry
    journal_entry = JournalEntry(
        operation_id=assignment.operation_id,
        assignment_id=assignment.id,
        entry_type='vehicle_assigned',
        content=f'Fahrzeug {vehicle.callsign} zu Auftrag {assignment.number} zugewiesen'
    )
    db.session.add(journal_entry)
    
    db.session.commit()
    
    return jsonify(assignment.to_dict())

@bp.route('/<int:assignment_id>/vehicles/<int:vehicle_id>', methods=['DELETE'])
@require_internal_api_key
def unassign_vehicle(assignment_id, vehicle_id):
    """Remove a vehicle from an assignment"""
    vehicle_assignment = VehicleAssignment.query.filter_by(
        vehicle_id=vehicle_id,
        assignment_id=assignment_id
    ).first()
    if not vehicle_assignment:
        return api_error('Vehicle assignment not found', 404, 'not_found')
    
    assignment, assignment_error = get_or_api_404(Assignment, assignment_id, 'assignment')
    if assignment_error:
        return assignment_error
    vehicle, vehicle_error = get_or_api_404(Vehicle, vehicle_id, 'vehicle')
    if vehicle_error:
        return vehicle_error
    
    db.session.delete(vehicle_assignment)
    
    # Check if assignment has any more vehicles
    remaining = VehicleAssignment.query.filter_by(assignment_id=assignment_id).count()
    if remaining == 0 and assignment.status == AssignmentStatus.ASSIGNED:
        assignment.status = AssignmentStatus.OPEN
    
    # Create journal entry
    journal_entry = JournalEntry(
        operation_id=assignment.operation_id,
        assignment_id=assignment.id,
        entry_type='vehicle_unassigned',
        content=f'Fahrzeug {vehicle.callsign} von Auftrag {assignment.number} entfernt'
    )
    db.session.add(journal_entry)
    
    db.session.commit()
    
    return jsonify({'message': 'Vehicle unassigned'}), 200

@bp.route('/upload', methods=['POST'])
@require_internal_api_key
def upload_pdf():
    """Upload PDF for an assignment"""
    if 'file' not in request.files:
        return api_error('No file provided', 400, 'file_missing')
    
    file = request.files['file']
    assignment_id = request.form.get('assignment_id')
    
    if not assignment_id:
        return api_error('assignment_id is required', 400, 'validation_error')
    
    assignment, error = get_or_api_404(Assignment, assignment_id, 'assignment')
    if error:
        return error
    
    if file.filename == '':
        return api_error('No file selected', 400, 'file_missing')
    
    is_pdf_ext = bool(file and file.filename and file.filename.lower().endswith('.pdf'))
    is_pdf_mime = file.mimetype in ('application/pdf', 'application/x-pdf')
    if is_pdf_ext and is_pdf_mime:
        filename = f"{assignment.number}_{secure_filename(file.filename)}"
        upload_dir = current_app.config.get('UPLOAD_FOLDER', '/app/uploads')
        os.makedirs(upload_dir, exist_ok=True)
        filepath = os.path.join(upload_dir, filename)
        file.save(filepath)
        
        assignment.pdf_file = filename
        db.session.commit()
        
        return jsonify({'filename': filename}), 200
    
    return api_error('Invalid file type', 400, 'invalid_file_type')
