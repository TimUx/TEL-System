from datetime import datetime, timezone
import enum

from app import db
from sqlalchemy import Enum, Index, UniqueConstraint, text



def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class OperationStatus(enum.Enum):
    ACTIVE = "active"
    CLOSED = "closed"


class AssignmentStatus(enum.Enum):
    OPEN = "open"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class VehicleStatus(enum.Enum):
    AVAILABLE = "available"
    ALERTED = "alerted"
    EN_ROUTE = "en_route"
    ON_SCENE = "on_scene"
    UNAVAILABLE = "unavailable"
    OUT_OF_SERVICE = "out_of_service"


class JournalEntrySource(enum.Enum):
    USER = "user"
    SYSTEM = "system"


class Operation(db.Model):
    __tablename__ = 'operations'
    __table_args__ = (
        Index('ix_operations_status', 'status'),
        Index(
            'uq_operations_single_active',
            'status',
            unique=True,
            sqlite_where=text("status = 'ACTIVE'"),
            postgresql_where=text("status = 'ACTIVE'")
        ),
    )

    id = db.Column(db.Integer, primary_key=True)
    number = db.Column(db.String(20), unique=True, nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    status = db.Column(Enum(OperationStatus), default=OperationStatus.ACTIVE, nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)
    closed_at = db.Column(db.DateTime)

    assignments = db.relationship('Assignment', back_populates='operation', cascade='all, delete-orphan')
    journal_entries = db.relationship('JournalEntry', back_populates='operation', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'number': self.number,
            'title': self.title,
            'description': self.description,
            'status': self.status.value,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'closed_at': self.closed_at.isoformat() if self.closed_at else None,
        }


class Location(db.Model):
    __tablename__ = 'locations'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    address = db.Column(db.String(500), nullable=False)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)

    vehicles = db.relationship('Vehicle', back_populates='location')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'address': self.address,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Vehicle(db.Model):
    __tablename__ = 'vehicles'
    __table_args__ = (
        Index('ix_vehicles_location_id', 'location_id'),
        Index('ix_vehicles_status', 'status'),
    )

    id = db.Column(db.Integer, primary_key=True)
    callsign = db.Column(db.String(50), nullable=False, unique=True)
    vehicle_type = db.Column(db.String(100))
    crew_count = db.Column(db.Integer, default=0)
    location_id = db.Column(db.Integer, db.ForeignKey('locations.id'))
    status = db.Column(Enum(VehicleStatus), default=VehicleStatus.AVAILABLE, nullable=False)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)

    location = db.relationship('Location', back_populates='vehicles')
    assignments = db.relationship('VehicleAssignment', back_populates='vehicle', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'callsign': self.callsign,
            'vehicle_type': self.vehicle_type,
            'crew_count': self.crew_count,
            'location_id': self.location_id,
            'location_name': self.location.name if self.location else None,
            'status': self.status.value,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Assignment(db.Model):
    __tablename__ = 'assignments'
    __table_args__ = (
        Index('ix_assignments_operation_id', 'operation_id'),
        Index('ix_assignments_status', 'status'),
        Index('ix_assignments_operation_status', 'operation_id', 'status'),
    )

    id = db.Column(db.Integer, primary_key=True)
    operation_id = db.Column(db.Integer, db.ForeignKey('operations.id'), nullable=False)
    number = db.Column(db.String(20), unique=True, nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    location_address = db.Column(db.String(500))
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    status = db.Column(Enum(AssignmentStatus), default=AssignmentStatus.OPEN, nullable=False)
    pdf_file = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)
    completed_at = db.Column(db.DateTime)

    operation = db.relationship('Operation', back_populates='assignments')
    vehicle_assignments = db.relationship('VehicleAssignment', back_populates='assignment', cascade='all, delete-orphan')
    journal_entries = db.relationship('JournalEntry', back_populates='assignment')

    def to_dict(self):
        vehicles = [va.vehicle.callsign for va in self.vehicle_assignments]
        vehicle_ids = [va.vehicle_id for va in self.vehicle_assignments]
        return {
            'id': self.id,
            'operation_id': self.operation_id,
            'number': self.number,
            'title': self.title,
            'description': self.description,
            'location_address': self.location_address,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'status': self.status.value,
            'pdf_file': self.pdf_file,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'vehicles': vehicles,
            'vehicle_ids': vehicle_ids,
            'vehicle_count': len(vehicle_ids),
        }


class VehicleAssignment(db.Model):
    __tablename__ = 'vehicle_assignments'
    __table_args__ = (
        UniqueConstraint('vehicle_id', 'assignment_id', name='uq_vehicle_assignment_pair'),
        Index('ix_vehicle_assignments_vehicle_id', 'vehicle_id'),
        Index('ix_vehicle_assignments_assignment_id', 'assignment_id'),
        Index('ix_vehicle_assignments_vehicle_order', 'vehicle_id', 'order'),
    )

    id = db.Column(db.Integer, primary_key=True)
    vehicle_id = db.Column(db.Integer, db.ForeignKey('vehicles.id'), nullable=False)
    assignment_id = db.Column(db.Integer, db.ForeignKey('assignments.id'), nullable=False)
    order = db.Column(db.Integer, default=0)
    assigned_at = db.Column(db.DateTime, default=utcnow, nullable=False)

    vehicle = db.relationship('Vehicle', back_populates='assignments')
    assignment = db.relationship('Assignment', back_populates='vehicle_assignments')

    def to_dict(self):
        return {
            'id': self.id,
            'vehicle_id': self.vehicle_id,
            'assignment_id': self.assignment_id,
            'order': self.order,
            'assigned_at': self.assigned_at.isoformat() if self.assigned_at else None,
        }


class JournalEntry(db.Model):
    __tablename__ = 'journal_entries'
    __table_args__ = (
        Index('ix_journal_entries_operation_id', 'operation_id'),
        Index('ix_journal_entries_assignment_id', 'assignment_id'),
        Index('ix_journal_entries_timestamp', 'timestamp'),
        Index('ix_journal_entries_operation_timestamp', 'operation_id', 'timestamp'),
    )

    id = db.Column(db.Integer, primary_key=True)
    operation_id = db.Column(db.Integer, db.ForeignKey('operations.id'), nullable=False)
    assignment_id = db.Column(db.Integer, db.ForeignKey('assignments.id'))
    timestamp = db.Column(db.DateTime, default=utcnow, nullable=False)
    entry_type = db.Column(db.String(50), nullable=False, default='note')
    source = db.Column(Enum(JournalEntrySource), default=JournalEntrySource.USER, nullable=False)
    content = db.Column(db.Text, nullable=False)

    operation = db.relationship('Operation', back_populates='journal_entries')
    assignment = db.relationship('Assignment', back_populates='journal_entries')

    def to_dict(self):
        return {
            'id': self.id,
            'operation_id': self.operation_id,
            'assignment_id': self.assignment_id,
            'assignment_number': self.assignment.number if self.assignment else None,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'entry_type': self.entry_type,
            'source': self.source.value,
            'content': self.content,
        }


class Settings(db.Model):
    __tablename__ = 'settings'

    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(100), unique=True, nullable=False)
    value = db.Column(db.Text)

    def to_dict(self):
        return {
            'key': self.key,
            'value': self.value,
        }
