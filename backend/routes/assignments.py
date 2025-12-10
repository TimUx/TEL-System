from flask import Blueprint, request, jsonify
from app import db
from models import Assignment, Operation, VehicleAssignment, Vehicle, JournalEntry, AssignmentStatus, OperationStatus
from datetime import datetime
from geopy.geocoders import Nominatim
from sqlalchemy import desc
import os

bp = Blueprint('assignments', __name__, url_prefix='/api/assignments')
geolocator = Nominatim(user_agent="tel-system")

@bp.route('/', methods=['GET'])
def get_assignments():
    """Get all assignments for active operation"""
    operation_id = request.args.get('operation_id')
    
    if operation_id:
        assignments = Assignment.query.filter_by(operation_id=operation_id).all()
    else:
        # Get active operation
        operation = Operation.query.filter_by(status=OperationStatus.ACTIVE).first()
        if operation:
            assignments = Assignment.query.filter_by(operation_id=operation.id).all()
        else:
            assignments = []
    
    return jsonify([a.to_dict() for a in assignments])

@bp.route('/', methods=['POST'])
def create_assignment():
    """Create a new assignment"""
    data = request.json
    
    # Get or create active operation
    operation_id = data.get('operation_id')
    if not operation_id:
        operation = Operation.query.filter_by(status=OperationStatus.ACTIVE).first()
        if not operation:
            return jsonify({'error': 'No active operation found'}), 400
        operation_id = operation.id
    
    # Generate assignment number
    last_assignment = Assignment.query.filter_by(
        operation_id=operation_id
    ).order_by(desc(Assignment.number)).first()
    
    if last_assignment:
        last_num = int(last_assignment.number.split('-')[-1])
        new_num = last_num + 1
    else:
        new_num = 1
    
    operation = Operation.query.get(operation_id)
    assignment_number = f"{operation.number}-{new_num:03d}"
    
    assignment = Assignment(
        operation_id=operation_id,
        number=assignment_number,
        title=data.get('title'),
        description=data.get('description'),
        location_address=data.get('location_address'),
        status=AssignmentStatus.OPEN
    )
    
    # Handle coordinates
    if 'latitude' in data and 'longitude' in data:
        assignment.latitude = data['latitude']
        assignment.longitude = data['longitude']
    elif data.get('location_address'):
        # Try to geocode
        try:
            geo_result = geolocator.geocode(data['location_address'])
            if geo_result:
                assignment.latitude = geo_result.latitude
                assignment.longitude = geo_result.longitude
        except Exception as e:
            print(f"Geocoding error: {e}")
    
    db.session.add(assignment)
    db.session.commit()
    
    # Create journal entry
    journal_entry = JournalEntry(
        operation_id=operation_id,
        assignment_id=assignment.id,
        entry_type='status_change',
        content=f'Auftrag {assignment.number} erstellt: {assignment.title}'
    )
    db.session.add(journal_entry)
    db.session.commit()
    
    return jsonify(assignment.to_dict()), 201

@bp.route('/<int:assignment_id>', methods=['GET'])
def get_assignment(assignment_id):
    """Get a single assignment"""
    assignment = Assignment.query.get_or_404(assignment_id)
    return jsonify(assignment.to_dict())

@bp.route('/<int:assignment_id>', methods=['PUT'])
def update_assignment(assignment_id):
    """Update an assignment"""
    assignment = Assignment.query.get_or_404(assignment_id)
    
    # Check if operation is closed
    if assignment.operation.status == OperationStatus.CLOSED:
        return jsonify({'error': 'Cannot modify assignment in closed operation'}), 400
    
    data = request.json
    
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
            print(f"Geocoding error: {e}")
    if 'latitude' in data:
        assignment.latitude = data['latitude']
    if 'longitude' in data:
        assignment.longitude = data['longitude']
    
    db.session.commit()
    return jsonify(assignment.to_dict())

@bp.route('/<int:assignment_id>/complete', methods=['POST'])
def complete_assignment(assignment_id):
    """Mark an assignment as completed"""
    assignment = Assignment.query.get_or_404(assignment_id)
    
    if assignment.operation.status == OperationStatus.CLOSED:
        return jsonify({'error': 'Cannot modify assignment in closed operation'}), 400
    
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
def assign_vehicle(assignment_id):
    """Assign a vehicle to an assignment"""
    assignment = Assignment.query.get_or_404(assignment_id)
    data = request.json
    vehicle_id = data.get('vehicle_id')
    
    if not vehicle_id:
        return jsonify({'error': 'vehicle_id is required'}), 400
    
    vehicle = Vehicle.query.get_or_404(vehicle_id)
    
    # Check if vehicle is already assigned to this assignment
    existing = VehicleAssignment.query.filter_by(
        vehicle_id=vehicle_id,
        assignment_id=assignment_id
    ).first()
    
    if existing:
        return jsonify({'error': 'Vehicle already assigned to this assignment'}), 400
    
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
def unassign_vehicle(assignment_id, vehicle_id):
    """Remove a vehicle from an assignment"""
    vehicle_assignment = VehicleAssignment.query.filter_by(
        vehicle_id=vehicle_id,
        assignment_id=assignment_id
    ).first_or_404()
    
    assignment = Assignment.query.get(assignment_id)
    vehicle = Vehicle.query.get(vehicle_id)
    
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
def upload_pdf():
    """Upload PDF for an assignment"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    assignment_id = request.form.get('assignment_id')
    
    if not assignment_id:
        return jsonify({'error': 'assignment_id is required'}), 400
    
    assignment = Assignment.query.get_or_404(assignment_id)
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if file and file.filename.endswith('.pdf'):
        filename = f"{assignment.number}_{file.filename}"
        filepath = os.path.join('/app/uploads', filename)
        file.save(filepath)
        
        assignment.pdf_file = filename
        db.session.commit()
        
        return jsonify({'filename': filename}), 200
    
    return jsonify({'error': 'Invalid file type'}), 400
