from datetime import datetime
from database.db import db

class Settings(db.Model):
    __tablename__ = 'settings'
    id = db.Column(db.Integer, primary_key=True)
    doctor_name = db.Column(db.String(100), default='Dr. Alex Mercer')
    doctor_status = db.Column(db.String(50), default='active')  # 'active', 'away', 'on_break', 'offline'
    doctor_speed = db.Column(db.String(50), default='normal')    # 'fast', 'normal', 'slow'
    fallback_avg_time = db.Column(db.Integer, default=10)
    current_room = db.Column(db.String(50), default='Consultation Room 1')

    def to_dict(self):
        return {
            'id': self.id,
            'doctor_name': self.doctor_name,
            'doctor_status': self.doctor_status,
            'doctor_speed': self.doctor_speed,
            'fallback_avg_time': self.fallback_avg_time,
            'current_room': self.current_room
        }

class Patients(db.Model):
    __tablename__ = 'patients'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(100), nullable=False)
    age = db.Column(db.Integer)
    gender = db.Column(db.String(20))
    phone = db.Column(db.String(20))
    email = db.Column(db.String(100))
    symptoms = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    queue_entries = db.relationship('Queue', back_populates='patient', cascade='all, delete-orphan')
    history_entries = db.relationship('ConsultationHistory', back_populates='patient', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'age': self.age,
            'gender': self.gender,
            'phone': self.phone,
            'email': self.email,
            'symptoms': self.symptoms,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Queue(db.Model):
    __tablename__ = 'queue'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id'), nullable=False)
    token = db.Column(db.String(50), unique=True, nullable=False)
    status = db.Column(db.String(50), default='waiting')  # 'waiting', 'consulting', 'skipped', 'completed', 'removed'
    priority = db.Column(db.String(50), default='medium')  # 'low', 'medium', 'high', 'emergency'
    consultation_type = db.Column(db.String(100), default='consultation') # 'checkup', 'consultation', 'follow_up', 'emergency'
    notes = db.Column(db.Text)
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)
    called_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    position = db.Column(db.Integer)

    # Relationships
    patient = db.relationship('Patients', back_populates='queue_entries')

    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'patient': self.patient.to_dict() if self.patient else None,
            'token': self.token,
            'status': self.status,
            'priority': self.priority,
            'consultation_type': self.consultation_type,
            'notes': self.notes,
            'joined_at': self.joined_at.isoformat() if self.joined_at else None,
            'called_at': self.called_at.isoformat() if self.called_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'position': self.position
        }

class ConsultationHistory(db.Model):
    __tablename__ = 'consultation_history'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id'), nullable=False)
    token = db.Column(db.String(50), nullable=False)
    duration_minutes = db.Column(db.Float, nullable=False)
    completed_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    patient = db.relationship('Patients', back_populates='history_entries')

    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'patient_name': self.patient.name if self.patient else 'Unknown',
            'token': self.token,
            'duration_minutes': self.duration_minutes,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None
        }

class AuditLogs(db.Model):
    __tablename__ = 'audit_logs'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    action_type = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    user_role = db.Column(db.String(50), default='receptionist')

    def to_dict(self):
        return {
            'id': self.id,
            'action_type': self.action_type,
            'description': self.description,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'user_role': self.user_role
        }

class Notifications(db.Model):
    __tablename__ = 'notifications'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    message = db.Column(db.Text, nullable=False)
    type = db.Column(db.String(50), default='info')  # 'info', 'success', 'warning', 'emergency'
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'message': self.message,
            'type': self.type,
            'is_read': self.is_read,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
