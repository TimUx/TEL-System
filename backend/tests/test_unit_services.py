import pytest

from models import Operation, Assignment, OperationStatus, AssignmentStatus
from services.operation_service import next_operation_number
from services.assignment_service import next_assignment_number
from app import db

pytestmark = pytest.mark.unit


def test_next_operation_number_starts_at_001(app):
    with app.app_context():
        result = next_operation_number()
    assert result.endswith('-001')


def test_next_operation_number_increments(app):
    with app.app_context():
        op = Operation(number='2026-007', title='Test', status=OperationStatus.ACTIVE)
        db.session.add(op)
        db.session.commit()
        result = next_operation_number()
    assert result == '2026-008'


def test_next_assignment_number_starts_at_001(app):
    with app.app_context():
        op = Operation(number='2026-010', title='Lage', status=OperationStatus.ACTIVE)
        db.session.add(op)
        db.session.commit()
        result = next_assignment_number(op.id, op.number)
    assert result == '2026-010-001'


def test_next_assignment_number_increments(app):
    with app.app_context():
        op = Operation(number='2026-011', title='Lage', status=OperationStatus.ACTIVE)
        db.session.add(op)
        db.session.flush()
        assignment = Assignment(
            operation_id=op.id,
            number='2026-011-003',
            title='A3',
            status=AssignmentStatus.OPEN
        )
        db.session.add(assignment)
        db.session.commit()

        result = next_assignment_number(op.id, op.number)
    assert result == '2026-011-004'
