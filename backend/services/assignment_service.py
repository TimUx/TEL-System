from sqlalchemy import desc
from models import Assignment


def next_assignment_number(operation_id, operation_number):
    last_assignment = Assignment.query.filter_by(
        operation_id=operation_id
    ).order_by(desc(Assignment.number)).first()
    next_num = int(last_assignment.number.split('-')[-1]) + 1 if last_assignment else 1
    return f"{operation_number}-{next_num:03d}"
