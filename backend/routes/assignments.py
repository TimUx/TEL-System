import os
from datetime import datetime, timezone
from uuid import uuid4

from flask import Blueprint, current_app, jsonify, request
from PyPDF2 import PdfReader
from sqlalchemy import desc
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload, selectinload

from api_utils import api_error, get_or_api_404, log_exception, parse_json_body, parse_pagination, require_internal_api_key
from app import db
from models import Assignment, AssignmentStatus, Operation, OperationStatus, Vehicle, VehicleAssignment, VehicleStatus
from services.assignment_service import can_transition_assignment_status, next_assignment_number, normalize_assignment_status
from services.geocoding_service import schedule_assignment_geocoding
from services.journal_service import create_system_event


bp = Blueprint('assignments', __name__, url_prefix='/api/assignments')
PDF_SIGNATURE = b'%PDF-'
ALLOWED_PDF_MIMES = {'application/pdf', 'application/x-pdf'}
ACTIVE_VEHICLE_STATUSES = {VehicleStatus.ALERTED, VehicleStatus.EN_ROUTE, VehicleStatus.ON_SCENE}



def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)



def _active_operation():
    return Operation.query.filter_by(status=OperationStatus.ACTIVE).order_by(desc(Operation.created_at)).first()



def _assignments_query():
    return Assignment.query.options(
        selectinload(Assignment.vehicle_assignments).joinedload(VehicleAssignment.vehicle)
    )



def _apply_status_transition(assignment, target_status, *, auto=False):
    target = normalize_assignment_status(target_status)
    if target == assignment.status:
        return None
    if not can_transition_assignment_status(assignment.status, target):
        return api_error(
            'Invalid assignment status transition',
            400,
            'invalid_status_transition',
            {'from': assignment.status.value, 'to': target.value},
        )
    previous = assignment.status
    assignment.status = target
    assignment.completed_at = utcnow() if target == AssignmentStatus.COMPLETED else None
    entry_type = 'assignment_status_changed'
    prefix = 'Status automatisch geändert' if auto else 'Status geändert'
    return create_system_event(
        assignment.operation_id,
        f'Auftrag {assignment.number}: {prefix}: {previous.value} → {target.value}',
        assignment_id=assignment.id,
        entry_type=entry_type,
    )



def _sync_vehicle_status_after_unassign(vehicle):
    active_links = (
        VehicleAssignment.query.join(Assignment)
        .filter(
            VehicleAssignment.vehicle_id == vehicle.id,
            Assignment.status != AssignmentStatus.COMPLETED,
        )
        .count()
    )
    if active_links == 0 and vehicle.status in ACTIVE_VEHICLE_STATUSES:
        previous = vehicle.status
        vehicle.status = VehicleStatus.AVAILABLE
        return create_system_event(
            _active_operation().id if _active_operation() else None,
            f'Fahrzeug {vehicle.callsign}: Status geändert: {previous.value} → {vehicle.status.value}',
            entry_type='vehicle_status_changed',
        ) if _active_operation() else None
    return None



def _validate_pdf(file_storage):
    if not file_storage or not file_storage.filename:
        return None, api_error('No file selected', 400, 'file_missing')
    if not file_storage.filename.lower().endswith('.pdf'):
        return None, api_error('Invalid file extension', 400, 'invalid_file_type')
    if file_storage.mimetype not in ALLOWED_PDF_MIMES:
        return None, api_error('Invalid file MIME type', 400, 'invalid_file_type')

    file_storage.stream.seek(0, os.SEEK_END)
    size = file_storage.stream.tell()
    file_storage.stream.seek(0)
    if size == 0:
        return None, api_error('Uploaded file is empty', 400, 'invalid_file')
    if size > current_app.config['MAX_PDF_UPLOAD_SIZE']:
        return None, api_error('Uploaded file exceeds the PDF size limit', 413, 'file_too_large')

    header = file_storage.stream.read(len(PDF_SIGNATURE))
    file_storage.stream.seek(0)
    if header != PDF_SIGNATURE:
        return None, api_error('Uploaded file is not a valid PDF', 400, 'invalid_file')

    try:
        reader = PdfReader(file_storage.stream)
        if len(reader.pages) < 1:
            return None, api_error('Uploaded file is not a valid PDF', 400, 'invalid_file')
    except Exception:
        return None, api_error('Uploaded file is not a valid PDF', 400, 'invalid_file')
    finally:
        file_storage.stream.seek(0)

    return size, None


@bp.route('/', methods=['GET'])
def get_assignments():
    operation_id = request.args.get('operation_id')
    limit, offset, error = parse_pagination()
    if error:
        return error

    query = _assignments_query().order_by(desc(Assignment.number))
    if operation_id:
        query = query.filter_by(operation_id=operation_id)
    else:
        operation = _active_operation()
        if not operation:
            return jsonify([])
        query = query.filter_by(operation_id=operation.id)

    assignments = query.limit(limit).offset(offset).all()
    return jsonify([assignment.to_dict() for assignment in assignments])


@bp.route('/', methods=['POST'])
@require_internal_api_key
def create_assignment():
    data, error = parse_json_body(required_fields=['title'])
    if error:
        return error

    operation_id = data.get('operation_id')
    if not operation_id:
        operation = _active_operation()
        if not operation:
            return api_error('No active operation found', 400, 'no_active_operation')
        operation_id = operation.id

    operation, operation_error = get_or_api_404(Operation, operation_id, 'operation')
    if operation_error:
        return operation_error
    if operation.status == OperationStatus.CLOSED:
        return api_error('Cannot create assignment in closed operation', 400, 'operation_closed')

    for _ in range(3):
        try:
            assignment = Assignment(
                operation_id=operation_id,
                number=next_assignment_number(operation_id, operation.number),
                title=data['title'],
                description=data.get('description'),
                location_address=data.get('location_address'),
                status=AssignmentStatus.OPEN,
            )
            if data.get('latitude') is not None and data.get('longitude') is not None:
                assignment.latitude = data['latitude']
                assignment.longitude = data['longitude']
            db.session.add(assignment)
            db.session.flush()
            db.session.add(create_system_event(
                operation_id,
                f'Auftrag {assignment.number} erstellt: {assignment.title}',
                assignment_id=assignment.id,
                entry_type='assignment_created',
            ))
            db.session.commit()
            if assignment.location_address and assignment.latitude is None and assignment.longitude is None:
                schedule_assignment_geocoding(current_app._get_current_object(), assignment.id, assignment.location_address)
            return jsonify(_assignments_query().filter_by(id=assignment.id).first().to_dict()), 201
        except IntegrityError:
            db.session.rollback()
        except Exception as error:
            db.session.rollback()
            log_exception('create_assignment failed', error)
            return api_error('Failed to create assignment', 500, 'assignment_create_failed')

    return api_error('Failed to allocate assignment number. Please retry.', 409, 'assignment_number_conflict')


@bp.route('/<int:assignment_id>', methods=['GET'])
def get_assignment(assignment_id):
    assignment = _assignments_query().filter_by(id=assignment_id).first()
    if not assignment:
        return api_error('assignment not found', 404, 'not_found')
    return jsonify(assignment.to_dict())


@bp.route('/<int:assignment_id>', methods=['PUT'])
@require_internal_api_key
def update_assignment(assignment_id):
    assignment, obj_error = get_or_api_404(Assignment, assignment_id, 'assignment')
    if obj_error:
        return obj_error
    if assignment.operation.status == OperationStatus.CLOSED:
        return api_error('Cannot modify assignment in closed operation', 400, 'operation_closed')

    data, error = parse_json_body()
    if error:
        return error

    changes = []
    geocode_address = None
    if 'title' in data and data['title'] != assignment.title:
        changes.append(f'Titel: {assignment.title} → {data["title"]}')
        assignment.title = data['title']
    if 'description' in data and data['description'] != assignment.description:
        changes.append('Beschreibung aktualisiert')
        assignment.description = data['description']
    if 'location_address' in data and data['location_address'] != assignment.location_address:
        assignment.location_address = data['location_address']
        changes.append('Einsatzort aktualisiert')
        if data.get('latitude') is None and data.get('longitude') is None:
            assignment.latitude = None
            assignment.longitude = None
            geocode_address = assignment.location_address
    if 'latitude' in data:
        assignment.latitude = data['latitude']
    if 'longitude' in data:
        assignment.longitude = data['longitude']

    status_event = None
    if 'status' in data:
        status_event = _apply_status_transition(assignment, data['status'])
        if isinstance(status_event, tuple):
            return status_event
        if status_event:
            changes.append('Status aktualisiert')
            db.session.add(status_event)

    if changes:
        db.session.add(create_system_event(
            assignment.operation_id,
            f'Auftrag {assignment.number} geändert: ' + '; '.join(changes),
            assignment_id=assignment.id,
            entry_type='assignment_updated',
        ))
    db.session.commit()

    if geocode_address:
        schedule_assignment_geocoding(current_app._get_current_object(), assignment.id, geocode_address)

    return jsonify(_assignments_query().filter_by(id=assignment.id).first().to_dict())


@bp.route('/<int:assignment_id>/status', methods=['POST'])
@require_internal_api_key
def update_assignment_status(assignment_id):
    assignment, error = get_or_api_404(Assignment, assignment_id, 'assignment')
    if error:
        return error
    if assignment.operation.status == OperationStatus.CLOSED:
        return api_error('Cannot modify assignment in closed operation', 400, 'operation_closed')

    data, parse_error = parse_json_body(required_fields=['status'])
    if parse_error:
        return parse_error

    event = _apply_status_transition(assignment, data['status'])
    if isinstance(event, tuple):
        return event
    if event:
        db.session.add(event)
    db.session.commit()
    return jsonify(_assignments_query().filter_by(id=assignment.id).first().to_dict())


@bp.route('/<int:assignment_id>/complete', methods=['POST'])
@require_internal_api_key
def complete_assignment(assignment_id):
    assignment, error = get_or_api_404(Assignment, assignment_id, 'assignment')
    if error:
        return error
    if assignment.operation.status == OperationStatus.CLOSED:
        return api_error('Cannot modify assignment in closed operation', 400, 'operation_closed')

    event = _apply_status_transition(assignment, AssignmentStatus.COMPLETED)
    if isinstance(event, tuple):
        return event
    if event:
        db.session.add(event)
    db.session.add(create_system_event(
        assignment.operation_id,
        f'Auftrag {assignment.number} abgeschlossen',
        assignment_id=assignment.id,
        entry_type='assignment_completed',
    ))
    db.session.commit()
    return jsonify(_assignments_query().filter_by(id=assignment.id).first().to_dict())


@bp.route('/<int:assignment_id>/vehicles', methods=['POST'])
@require_internal_api_key
def assign_vehicle(assignment_id):
    assignment, assignment_error = get_or_api_404(Assignment, assignment_id, 'assignment')
    if assignment_error:
        return assignment_error
    if assignment.operation.status == OperationStatus.CLOSED:
        return api_error('Cannot modify assignment in closed operation', 400, 'operation_closed')

    data, error = parse_json_body(required_fields=['vehicle_id'])
    if error:
        return error
    vehicle, vehicle_error = get_or_api_404(Vehicle, data['vehicle_id'], 'vehicle')
    if vehicle_error:
        return vehicle_error
    if vehicle.status == VehicleStatus.OUT_OF_SERVICE:
        return api_error('Vehicle is out of service', 400, 'vehicle_unavailable')

    try:
        max_order = db.session.query(db.func.max(VehicleAssignment.order)).filter_by(vehicle_id=vehicle.id).scalar() or 0
        db.session.add(VehicleAssignment(vehicle_id=vehicle.id, assignment_id=assignment.id, order=max_order + 1))

        status_event = None
        if assignment.status == AssignmentStatus.OPEN:
            status_event = _apply_status_transition(assignment, AssignmentStatus.ASSIGNED, auto=True)
        if status_event and not isinstance(status_event, tuple):
            db.session.add(status_event)

        if vehicle.status == VehicleStatus.AVAILABLE:
            previous_status = vehicle.status
            vehicle.status = VehicleStatus.ALERTED
            db.session.add(create_system_event(
                assignment.operation_id,
                f'Fahrzeug {vehicle.callsign}: Status geändert: {previous_status.value} → {vehicle.status.value}',
                assignment_id=assignment.id,
                entry_type='vehicle_status_changed',
            ))

        db.session.add(create_system_event(
            assignment.operation_id,
            f'Fahrzeug {vehicle.callsign} zu Auftrag {assignment.number} zugewiesen',
            assignment_id=assignment.id,
            entry_type='vehicle_assigned',
        ))
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return api_error('Vehicle already assigned to this assignment', 409, 'vehicle_already_assigned')

    return jsonify(_assignments_query().filter_by(id=assignment.id).first().to_dict())


@bp.route('/<int:assignment_id>/vehicles/<int:vehicle_id>', methods=['DELETE'])
@require_internal_api_key
def unassign_vehicle(assignment_id, vehicle_id):
    vehicle_assignment = VehicleAssignment.query.filter_by(vehicle_id=vehicle_id, assignment_id=assignment_id).first()
    if not vehicle_assignment:
        return api_error('Vehicle assignment not found', 404, 'not_found')

    assignment, assignment_error = get_or_api_404(Assignment, assignment_id, 'assignment')
    if assignment_error:
        return assignment_error
    if assignment.operation.status == OperationStatus.CLOSED:
        return api_error('Cannot modify assignment in closed operation', 400, 'operation_closed')
    vehicle, vehicle_error = get_or_api_404(Vehicle, vehicle_id, 'vehicle')
    if vehicle_error:
        return vehicle_error

    db.session.delete(vehicle_assignment)
    db.session.flush()

    remaining = VehicleAssignment.query.filter_by(assignment_id=assignment_id).count()
    if remaining == 0 and assignment.status in {AssignmentStatus.ASSIGNED, AssignmentStatus.IN_PROGRESS}:
        status_event = _apply_status_transition(assignment, AssignmentStatus.OPEN, auto=True)
        if status_event and not isinstance(status_event, tuple):
            db.session.add(status_event)

    vehicle_status_event = _sync_vehicle_status_after_unassign(vehicle)
    if vehicle_status_event:
        db.session.add(vehicle_status_event)

    db.session.add(create_system_event(
        assignment.operation_id,
        f'Fahrzeug {vehicle.callsign} von Auftrag {assignment.number} entfernt',
        assignment_id=assignment.id,
        entry_type='vehicle_unassigned',
    ))
    db.session.commit()
    return jsonify({'message': 'Vehicle unassigned'}), 200


@bp.route('/upload', methods=['POST'])
@require_internal_api_key
def upload_pdf():
    if 'file' not in request.files:
        return api_error('No file provided', 400, 'file_missing')

    assignment_id = request.form.get('assignment_id')
    if not assignment_id:
        return api_error('assignment_id is required', 400, 'validation_error')

    assignment, error = get_or_api_404(Assignment, assignment_id, 'assignment')
    if error:
        return error
    if assignment.operation.status == OperationStatus.CLOSED:
        return api_error('Cannot modify assignment in closed operation', 400, 'operation_closed')

    file = request.files['file']
    _, validation_error = _validate_pdf(file)
    if validation_error:
        return validation_error

    upload_dir = current_app.config.get('UPLOAD_FOLDER', '/app/uploads')
    os.makedirs(upload_dir, exist_ok=True)
    filename = f'{assignment.number}_{uuid4().hex}.pdf'
    filepath = os.path.join(upload_dir, filename)
    file.save(filepath)

    assignment.pdf_file = filename
    db.session.add(create_system_event(
        assignment.operation_id,
        f'PDF zu Auftrag {assignment.number} hochgeladen',
        assignment_id=assignment.id,
        entry_type='assignment_pdf_uploaded',
    ))
    db.session.commit()
    return jsonify({'filename': filename}), 200
