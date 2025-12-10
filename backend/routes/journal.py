from flask import Blueprint, request, jsonify
from app import db
from models import JournalEntry, Operation, Assignment, OperationStatus
from datetime import datetime
from sqlalchemy import desc

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
    
    entries = query.order_by(JournalEntry.timestamp).all()
    return jsonify([e.to_dict() for e in entries])

@bp.route('/', methods=['POST'])
def create_journal_entry():
    """Create a new journal entry"""
    data = request.json
    
    operation_id = data.get('operation_id')
    if not operation_id:
        operation = Operation.query.filter_by(status=OperationStatus.ACTIVE).first()
        if not operation:
            return jsonify({'error': 'No active operation found'}), 400
        operation_id = operation.id
    
    # Check if operation is closed
    operation = Operation.query.get(operation_id)
    if operation.status == OperationStatus.CLOSED:
        return jsonify({'error': 'Cannot add journal entry to closed operation'}), 400
    
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
def update_journal_entry(entry_id):
    """Update a journal entry"""
    entry = JournalEntry.query.get_or_404(entry_id)
    
    if entry.operation.status == OperationStatus.CLOSED:
        return jsonify({'error': 'Cannot modify journal entry in closed operation'}), 400
    
    data = request.json
    
    if 'content' in data:
        entry.content = data['content']
    if 'entry_type' in data:
        entry.entry_type = data['entry_type']
    
    db.session.commit()
    return jsonify(entry.to_dict())

@bp.route('/<int:entry_id>', methods=['DELETE'])
def delete_journal_entry(entry_id):
    """Delete a journal entry"""
    entry = JournalEntry.query.get_or_404(entry_id)
    
    if entry.operation.status == OperationStatus.CLOSED:
        return jsonify({'error': 'Cannot delete journal entry in closed operation'}), 400
    
    db.session.delete(entry)
    db.session.commit()
    
    return jsonify({'message': 'Journal entry deleted'}), 200
