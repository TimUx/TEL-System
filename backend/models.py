from app import db
from datetime import datetime
from sqlalchemy import Enum
import enum

class OperationStatus(enum.Enum):
    ACTIVE = "active"
    CLOSED = "closed"

class Operation(db.Model):
    """Einsatzlage - The main operation/incident"""
    __tablename__ = 'operations'
    
    id = db.Column(db.Integer, primary_key=True)
    number = db.Column(db.String(20), unique=True, nullable=False)  # YYYY-XXX format
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    status = db.Column(Enum(OperationStatus), default=OperationStatus.ACTIVE, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    closed_at = db.Column(db.DateTime)
    
    # Relationships
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
            'closed_at': self.closed_at.isoformat() if self.closed_at else None
        }

class Location(db.Model):
    """Feuerwehrstandort - Fire station location"""
    __tablename__ = 'locations'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    address = db.Column(db.String(500), nullable=False)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    vehicles = db.relationship('Vehicle', back_populates='location')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'address': self.address,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Vehicle(db.Model):
    """Fahrzeug - Fire vehicle"""
    __tablename__ = 'vehicles'
    
    id = db.Column(db.Integer, primary_key=True)
    callsign = db.Column(db.String(50), nullable=False, unique=True)  # Rufname
    vehicle_type = db.Column(db.String(100))  # Fahrzeugtyp (e.g., LF, DLK, etc.)
    crew_count = db.Column(db.Integer, default=0)  # Besatzung
    location_id = db.Column(db.Integer, db.ForeignKey('locations.id'))
    notes = db.Column(db.Text)  # Bemerkungen
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
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
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class AssignmentStatus(enum.Enum):
    OPEN = "open"
    ASSIGNED = "assigned"
    COMPLETED = "completed"

class Assignment(db.Model):
    """Auftrag - Task/Assignment"""
    __tablename__ = 'assignments'
    
    id = db.Column(db.Integer, primary_key=True)
    operation_id = db.Column(db.Integer, db.ForeignKey('operations.id'), nullable=False)
    number = db.Column(db.String(20), unique=True, nullable=False)
    title = db.Column(db.String(200), nullable=False)  # Einsatzstichwort
    description = db.Column(db.Text)
    location_address = db.Column(db.String(500))  # Einsatzort
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    status = db.Column(Enum(AssignmentStatus), default=AssignmentStatus.OPEN, nullable=False)
    pdf_file = db.Column(db.String(500))  # Path to PDF file
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    completed_at = db.Column(db.DateTime)
    
    # Relationships
    operation = db.relationship('Operation', back_populates='assignments')
    vehicle_assignments = db.relationship('VehicleAssignment', back_populates='assignment', cascade='all, delete-orphan')
    journal_entries = db.relationship('JournalEntry', back_populates='assignment')
    
    def to_dict(self):
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
            'vehicles': [va.vehicle.callsign for va in self.vehicle_assignments]
        }

class VehicleAssignment(db.Model):
    """Vehicle to Assignment mapping (queue)"""
    __tablename__ = 'vehicle_assignments'
    
    id = db.Column(db.Integer, primary_key=True)
    vehicle_id = db.Column(db.Integer, db.ForeignKey('vehicles.id'), nullable=False)
    assignment_id = db.Column(db.Integer, db.ForeignKey('assignments.id'), nullable=False)
    order = db.Column(db.Integer, default=0)  # Order in queue
    assigned_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    vehicle = db.relationship('Vehicle', back_populates='assignments')
    assignment = db.relationship('Assignment', back_populates='vehicle_assignments')
    
    def to_dict(self):
        return {
            'id': self.id,
            'vehicle_id': self.vehicle_id,
            'assignment_id': self.assignment_id,
            'order': self.order,
            'assigned_at': self.assigned_at.isoformat() if self.assigned_at else None
        }

class JournalEntry(db.Model):
    """Journal/Logbook entry - Einsatztagebuch"""
    __tablename__ = 'journal_entries'
    
    id = db.Column(db.Integer, primary_key=True)
    operation_id = db.Column(db.Integer, db.ForeignKey('operations.id'), nullable=False)
    assignment_id = db.Column(db.Integer, db.ForeignKey('assignments.id'))
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    entry_type = db.Column(db.String(50))  # instruction, note, decision, status_change, etc.
    content = db.Column(db.Text, nullable=False)
    
    # Relationships
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
            'content': self.content
        }

class Settings(db.Model):
    """System settings"""
    __tablename__ = 'settings'
    
    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(100), unique=True, nullable=False)
    value = db.Column(db.Text)
    
    def to_dict(self):
        return {
            'key': self.key,
            'value': self.value
        }
