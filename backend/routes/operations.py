from flask import Blueprint, request, jsonify
from app import db
from models import Operation, Assignment, JournalEntry, OperationStatus
from sqlalchemy import desc
from sqlalchemy.exc import IntegrityError
from api_utils import parse_json_body, parse_pagination, require_internal_api_key, log_exception, api_error, get_or_api_404
from services.operation_service import next_operation_number
from datetime import datetime

bp = Blueprint('operations', __name__, url_prefix='/api/operations')

@bp.route('/', methods=['GET'])
def get_operations():
    """Get all operations"""
    limit, offset, error = parse_pagination()
    if error:
        return error
    operations = Operation.query.order_by(desc(Operation.number)).limit(limit).offset(offset).all()
    return jsonify([op.to_dict() for op in operations])

@bp.route('/', methods=['POST'])
@require_internal_api_key
def create_operation():
    """Create a new operation"""
    data, error = parse_json_body(required_fields=['title'])
    if error:
        return error

    for _ in range(3):
        try:
            operation_number = next_operation_number()

            operation = Operation(
                number=operation_number,
                title=data['title'],
                description=data.get('description'),
                status=OperationStatus.ACTIVE
            )
            db.session.add(operation)
            db.session.flush()

            journal_entry = JournalEntry(
                operation_id=operation.id,
                entry_type='status_change',
                content=f'Einsatzlage "{operation.title}" erstellt'
            )
            db.session.add(journal_entry)
            db.session.commit()
            return jsonify(operation.to_dict()), 201
        except IntegrityError:
            db.session.rollback()
            continue
        except Exception as e:
            db.session.rollback()
            log_exception('create_operation failed', e)
            return api_error('Failed to create operation', 500, 'operation_create_failed')

    return api_error('Failed to allocate operation number. Please retry.', 409, 'operation_number_conflict')

@bp.route('/<int:operation_id>', methods=['GET'])
def get_operation(operation_id):
    """Get a single operation"""
    operation, error = get_or_api_404(Operation, operation_id, 'operation')
    if error:
        return error
    return jsonify(operation.to_dict())

@bp.route('/<int:operation_id>', methods=['PUT'])
@require_internal_api_key
def update_operation(operation_id):
    """Update an operation"""
    operation, obj_error = get_or_api_404(Operation, operation_id, 'operation')
    if obj_error:
        return obj_error
    data, error = parse_json_body()
    if error:
        return error
    
    if operation.status == OperationStatus.CLOSED:
        return api_error('Cannot modify closed operation', 400, 'operation_closed')
    
    if 'title' in data:
        operation.title = data['title']
    if 'description' in data:
        operation.description = data['description']
    
    db.session.commit()
    return jsonify(operation.to_dict())

@bp.route('/<int:operation_id>/close', methods=['POST'])
@require_internal_api_key
def close_operation(operation_id):
    """Close an operation"""
    operation, error = get_or_api_404(Operation, operation_id, 'operation')
    if error:
        return error
    
    if operation.status == OperationStatus.CLOSED:
        return api_error('Operation already closed', 400, 'operation_closed')
    
    operation.status = OperationStatus.CLOSED
    operation.closed_at = datetime.utcnow()
    
    # Create journal entry
    journal_entry = JournalEntry(
        operation_id=operation.id,
        entry_type='status_change',
        content=f'Einsatzlage geschlossen'
    )
    db.session.add(journal_entry)
    db.session.commit()
    
    return jsonify(operation.to_dict())

@bp.route('/active', methods=['GET'])
def get_active_operation():
    """Get the currently active operation"""
    operation = Operation.query.filter_by(status=OperationStatus.ACTIVE).first()
    if operation:
        return jsonify(operation.to_dict())
    return jsonify(None)
