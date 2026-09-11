from sqlalchemy import desc

from models import Assignment, AssignmentStatus


ALLOWED_ASSIGNMENT_TRANSITIONS = {
    AssignmentStatus.OPEN: {AssignmentStatus.OPEN, AssignmentStatus.ASSIGNED},
    AssignmentStatus.ASSIGNED: {
        AssignmentStatus.OPEN,
        AssignmentStatus.ASSIGNED,
        AssignmentStatus.IN_PROGRESS,
        AssignmentStatus.COMPLETED,
    },
    AssignmentStatus.IN_PROGRESS: {
        AssignmentStatus.ASSIGNED,
        AssignmentStatus.IN_PROGRESS,
        AssignmentStatus.COMPLETED,
    },
    AssignmentStatus.COMPLETED: {AssignmentStatus.COMPLETED},
}



def next_assignment_number(operation_id, operation_number):
    last_assignment = Assignment.query.filter_by(
        operation_id=operation_id
    ).order_by(desc(Assignment.number)).first()
    next_num = int(last_assignment.number.split('-')[-1]) + 1 if last_assignment else 1
    return f"{operation_number}-{next_num:03d}"



def normalize_assignment_status(raw_status):
    if raw_status is None:
        return None
    if isinstance(raw_status, AssignmentStatus):
        return raw_status
    normalized = str(raw_status).strip().lower()
    for status in AssignmentStatus:
        if status.value == normalized:
            return status
    raise ValueError(f'Unsupported assignment status: {raw_status}')



def can_transition_assignment_status(current_status, target_status):
    target = normalize_assignment_status(target_status)
    return target in ALLOWED_ASSIGNMENT_TRANSITIONS[current_status]
