from flask import Blueprint, request, jsonify
from app import db
from models import JournalEntry, Operation, Assignment, OperationStatus
from datetime import datetime
from sqlalchemy import desc
from api_utils import parse_json_body, parse_pagination, require_internal_api_key, api_error, get_or_api_404

bp = Blueprint('journal', __name__, url_prefix='/api/journal')

@bp.route('/', methods=['GET'])
def get_journal_entries():
    """Get journal entries"""
    operation_id = request.args.get('operation_id')
    assignment_id = request.args.get('assignment_id')
    
    query = JournalEntry.query
    
    if operation_id:
        query = query.filter_by(operation_id=operation_id)
    elif assignment_id:
        query = query.filter_by(assignment_id=assignment_id)
    else:
        # Get active operation
        operation = Operation.query.filter_by(status=OperationStatus.ACTIVE).first()
        if operation:
            query = query.filter_by(operation_id=operation.id)
        else:
            return jsonify([])
    
    limit, offset, error = parse_pagination()
    if error:
        return error
    entries = query.order_by(JournalEntry.timestamp).limit(limit).offset(offset).all()
    return jsonify([e.to_dict() for e in entries])

@bp.route('/', methods=['POST'])
@require_internal_api_key
def create_journal_entry():
    """Create a new journal entry"""
    data, error = parse_json_body(required_fields=['content'])
    if error:
        return error
    
    operation_id = data.get('operation_id')
    if not operation_id:
        operation = Operation.query.filter_by(status=OperationStatus.ACTIVE).first()
        if not operation:
            return api_error('No active operation found', 400, 'no_active_operation')
        operation_id = operation.id
    
    # Check if operation is closed
    operation, op_error = get_or_api_404(Operation, operation_id, 'operation')
    if op_error:
        return op_error
    if operation.status == OperationStatus.CLOSED:
        return api_error('Cannot add journal entry to closed operation', 400, 'operation_closed')
    
    entry = JournalEntry(
        operation_id=operation_id,
        assignment_id=data.get('assignment_id'),
        entry_type=data.get('entry_type', 'note'),
        content=data.get('content'),
        timestamp=datetime.utcnow()
    )
    
    db.session.add(entry)
    db.session.commit()
    
    return jsonify(entry.to_dict()), 201

@bp.route('/<int:entry_id>', methods=['PUT'])
@require_internal_api_key
def update_journal_entry(entry_id):
    """Update a journal entry"""
    entry, error = get_or_api_404(JournalEntry, entry_id, 'journal_entry')
    if error:
        return error
    
    if entry.operation.status == OperationStatus.CLOSED:
        return api_error('Cannot modify journal entry in closed operation', 400, 'operation_closed')
    
    data, error = parse_json_body()
    if error:
        return error
    
    if 'content' in data:
        entry.content = data['content']
    if 'entry_type' in data:
        entry.entry_type = data['entry_type']
    
    db.session.commit()
    return jsonify(entry.to_dict())

@bp.route('/<int:entry_id>', methods=['DELETE'])
@require_internal_api_key
def delete_journal_entry(entry_id):
    """Delete a journal entry"""
    entry, error = get_or_api_404(JournalEntry, entry_id, 'journal_entry')
    if error:
        return error
    
    if entry.operation.status == OperationStatus.CLOSED:
        return api_error('Cannot delete journal entry in closed operation', 400, 'operation_closed')
    
    db.session.delete(entry)
    db.session.commit()
    
    return jsonify({'message': 'Journal entry deleted'}), 200
