from datetime import datetime
from sqlalchemy import desc
from models import Operation


def next_operation_number():
    current_year = datetime.utcnow().year
    last_operation = Operation.query.filter(
        Operation.number.like(f'{current_year}-%')
    ).order_by(desc(Operation.number)).first()
    next_num = int(last_operation.number.split('-')[1]) + 1 if last_operation else 1
    return f"{current_year}-{next_num:03d}"
