from flask import Blueprint, request, jsonify
from app import db
from models import Operation, Assignment, JournalEntry, OperationStatus
from datetime import datetime
from sqlalchemy import desc

bp = Blueprint('operations', __name__, url_prefix='/api/operations')

@bp.route('/', methods=['GET'])
def get_operations():
    """Get all operations"""
    operations = Operation.query.order_by(desc(Operation.number)).all()
    return jsonify([op.to_dict() for op in operations])

@bp.route('/', methods=['POST'])
def create_operation():
    """Create a new operation"""
    data = request.json
    
    # Generate operation number (YYYY-XXX format)
    current_year = datetime.utcnow().year
    last_operation = Operation.query.filter(
        Operation.number.like(f'{current_year}-%')
    ).order_by(desc(Operation.number)).first()
    
    if last_operation:
        last_num = int(last_operation.number.split('-')[1])
        new_num = last_num + 1
    else:
        new_num = 1
    
    operation_number = f"{current_year}-{new_num:03d}"
    
    operation = Operation(
        number=operation_number,
        title=data.get('title'),
        description=data.get('description'),
        status=OperationStatus.ACTIVE
    )
    
    db.session.add(operation)
    db.session.commit()
    
    # Create initial journal entry
    journal_entry = JournalEntry(
        operation_id=operation.id,
        entry_type='status_change',
        content=f'Einsatzlage "{operation.title}" erstellt'
    )
    db.session.add(journal_entry)
    db.session.commit()
    
    return jsonify(operation.to_dict()), 201

@bp.route('/<int:operation_id>', methods=['GET'])
def get_operation(operation_id):
    """Get a single operation"""
    operation = Operation.query.get_or_404(operation_id)
    return jsonify(operation.to_dict())

@bp.route('/<int:operation_id>', methods=['PUT'])
def update_operation(operation_id):
    """Update an operation"""
    operation = Operation.query.get_or_404(operation_id)
    data = request.json
    
    if operation.status == OperationStatus.CLOSED:
        return jsonify({'error': 'Cannot modify closed operation'}), 400
    
    if 'title' in data:
        operation.title = data['title']
    if 'description' in data:
        operation.description = data['description']
    
    db.session.commit()
    return jsonify(operation.to_dict())

@bp.route('/<int:operation_id>/close', methods=['POST'])
def close_operation(operation_id):
    """Close an operation"""
    operation = Operation.query.get_or_404(operation_id)
    
    if operation.status == OperationStatus.CLOSED:
        return jsonify({'error': 'Operation already closed'}), 400
    
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
