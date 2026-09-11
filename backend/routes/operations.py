from datetime import timezone, datetime

from flask import Blueprint, jsonify
from sqlalchemy import desc
from sqlalchemy.exc import IntegrityError

from api_utils import api_error, get_or_api_404, log_exception, parse_json_body, parse_pagination, require_internal_api_key
from app import db
from models import Operation, OperationStatus
from services.journal_service import create_system_event
from services.operation_service import next_operation_number


bp = Blueprint('operations', __name__, url_prefix='/api/operations')



def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


@bp.route('/', methods=['GET'])
def get_operations():
    limit, offset, error = parse_pagination()
    if error:
        return error
    operations = Operation.query.order_by(desc(Operation.number)).limit(limit).offset(offset).all()
    return jsonify([op.to_dict() for op in operations])


@bp.route('/', methods=['POST'])
@require_internal_api_key
def create_operation():
    data, error = parse_json_body(required_fields=['title'])
    if error:
        return error

    if Operation.query.filter_by(status=OperationStatus.ACTIVE).first():
        return api_error('An active operation already exists', 409, 'active_operation_exists')

    for _ in range(3):
        try:
            operation = Operation(
                number=next_operation_number(),
                title=data['title'],
                description=data.get('description'),
                status=OperationStatus.ACTIVE,
            )
            db.session.add(operation)
            db.session.flush()
            db.session.add(create_system_event(operation.id, f'Einsatzlage "{operation.title}" erstellt', entry_type='operation_created'))
            db.session.commit()
            return jsonify(operation.to_dict()), 201
        except IntegrityError as error:
            db.session.rollback()
            if 'uq_operations_single_active' in str(error.orig) or 'single_active' in str(error.orig):
                return api_error('An active operation already exists', 409, 'active_operation_exists')
        except Exception as error:
            db.session.rollback()
            log_exception('create_operation failed', error)
            return api_error('Failed to create operation', 500, 'operation_create_failed')

    return api_error('Failed to allocate operation number. Please retry.', 409, 'operation_number_conflict')


@bp.route('/<int:operation_id>', methods=['GET'])
def get_operation(operation_id):
    operation, error = get_or_api_404(Operation, operation_id, 'operation')
    if error:
        return error
    return jsonify(operation.to_dict())


@bp.route('/<int:operation_id>', methods=['PUT'])
@require_internal_api_key
def update_operation(operation_id):
    operation, obj_error = get_or_api_404(Operation, operation_id, 'operation')
    if obj_error:
        return obj_error

    if operation.status == OperationStatus.CLOSED:
        return api_error('Cannot modify closed operation', 400, 'operation_closed')

    data, error = parse_json_body()
    if error:
        return error

    changes = []
    if 'title' in data and data['title'] != operation.title:
        changes.append(f'Titel: {operation.title} → {data["title"]}')
        operation.title = data['title']
    if 'description' in data and data['description'] != operation.description:
        changes.append('Beschreibung aktualisiert')
        operation.description = data['description']

    if changes:
        db.session.add(create_system_event(operation.id, 'Einsatzlage geändert: ' + '; '.join(changes), entry_type='operation_updated'))
    db.session.commit()
    return jsonify(operation.to_dict())


@bp.route('/<int:operation_id>/close', methods=['POST'])
@require_internal_api_key
def close_operation(operation_id):
    operation, error = get_or_api_404(Operation, operation_id, 'operation')
    if error:
        return error

    if operation.status == OperationStatus.CLOSED:
        return api_error('Operation already closed', 400, 'operation_closed')

    operation.status = OperationStatus.CLOSED
    operation.closed_at = utcnow()
    db.session.add(create_system_event(operation.id, 'Einsatzlage geschlossen', entry_type='operation_closed'))
    db.session.commit()
    return jsonify(operation.to_dict())


@bp.route('/active', methods=['GET'])
def get_active_operation():
    operation = Operation.query.filter_by(status=OperationStatus.ACTIVE).order_by(desc(Operation.created_at)).first()
    if operation:
        return jsonify(operation.to_dict())
    return jsonify(None)
