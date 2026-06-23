import threading
from datetime import datetime
from database.db import db
from database.models import Patients, Queue, ConsultationHistory, AuditLogs, Notifications, Settings
from services.ai_engine import AiEngine

# Thread safety lock for concurrent requests (e.g., dual receptionists calling "Call Next" simultaneously)
queue_lock = threading.Lock()

class QueueManager:
    @staticmethod
    def generate_token(priority):
        """
        Generate a unique token based on priority.
        Emergency priority: E-101, E-102...
        Normal priority: QC-101, QC-102...
        """
        prefix = "E" if priority == 'emergency' else "QC"
        
        # Find today's last token matching prefix
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        last_entry = Queue.query.filter(
            Queue.joined_at >= today_start,
            Queue.token.like(f"{prefix}-%")
        ).order_by(Queue.id.desc()).first()
        
        if last_entry:
            try:
                # Extract digits and increment
                last_num = int(last_entry.token.split('-')[1])
                new_num = last_num + 1
            except (IndexError, ValueError):
                new_num = 101
        else:
            new_num = 101
            
        return f"{prefix}-{new_num}"

    @classmethod
    def add_patient_to_queue(cls, name, age, gender, phone, email, symptoms, priority, consultation_type, notes):
        """
        Registers a new patient and adds them to the queue.
        Thread-safe.
        """
        with queue_lock:
            # 1. Create Patient Record
            patient = Patients(
                name=name,
                age=age,
                gender=gender,
                phone=phone,
                email=email,
                symptoms=symptoms
            )
            db.session.add(patient)
            db.session.flush()  # Generates patient.id
            
            # 2. Generate Token
            token = cls.generate_token(priority)
            
            # 3. Create Queue Entry
            queue_entry = Queue(
                patient_id=patient.id,
                token=token,
                status='waiting',
                priority=priority,
                consultation_type=consultation_type,
                notes=notes
            )
            db.session.add(queue_entry)
            db.session.flush()
            
            # 4. Log Audit Trail
            log = AuditLogs(
                action_type='add_patient',
                description=f"Registered patient {name} (Token: {token})"
            )
            db.session.add(log)
            
            # 5. Create Notification
            notif = Notifications(
                message=f"New patient enqueued: {name} (Token: {token})",
                type='emergency' if priority == 'emergency' else 'info'
            )
            db.session.add(notif)
            
            db.session.commit()
            
            # 6. Recalculate Wait Times
            AiEngine.calculate_wait_times()
            
            return queue_entry

    @classmethod
    def call_next_patient(cls):
        """
        Completes the current consulting patient (if any) and calls the next waiting patient.
        Thread-safe.
        """
        with queue_lock:
            # 1. Complete current consulting patient if one exists
            current_consulting = Queue.query.filter_by(status='consulting').first()
            if current_consulting:
                cls._complete_patient_internal(current_consulting)
                
            # 2. Get next waiting patient
            # Ordered by priority (emergency first), then joined_at ASC
            all_waiting = Queue.query.filter_by(status='waiting').all()
            if not all_waiting:
                db.session.commit()
                return None
                
            # Sort: Emergency first, then regular, preserving chronological order
            waiting_emergency = sorted([q for q in all_waiting if q.priority == 'emergency'], key=lambda x: x.joined_at)
            waiting_normal = sorted([q for q in all_waiting if q.priority != 'emergency'], key=lambda x: x.joined_at)
            next_queue_list = waiting_emergency + waiting_normal
            
            next_patient = next_queue_list[0]
            
            # 3. Update status to consulting
            next_patient.status = 'consulting'
            next_patient.called_at = datetime.utcnow()
            next_patient.position = 0
            
            # 4. Log Action
            log = AuditLogs(
                action_type='call_patient',
                description=f"Called patient {next_patient.patient.name} (Token: {next_patient.token}) to Room"
            )
            db.session.add(log)
            
            # 5. Notification
            settings = Settings.query.first()
            room_name = settings.current_room if settings else "Consultation Room 1"
            notif = Notifications(
                message=f"Calling Token {next_patient.token} ({next_patient.patient.name}) to {room_name}",
                type='success'
            )
            db.session.add(notif)
            
            db.session.commit()
            
            # 6. Recalculate Wait Times
            AiEngine.calculate_wait_times()
            
            return next_patient

    @classmethod
    def skip_patient(cls, queue_id):
        """
        Skips a patient currently waiting or consulting.
        """
        with queue_lock:
            entry = db.session.get(Queue, queue_id)
            if not entry or entry.status not in ['waiting', 'consulting']:
                return None
                
            entry.status = 'skipped'
            entry.completed_at = datetime.utcnow()
            entry.position = 999
            
            log = AuditLogs(
                action_type='skip_patient',
                description=f"Skipped patient {entry.patient.name} (Token: {entry.token})"
            )
            db.session.add(log)
            
            notif = Notifications(
                message=f"Patient skipped: Token {entry.token}",
                type='warning'
            )
            db.session.add(notif)
            
            db.session.commit()
            AiEngine.calculate_wait_times()
            return entry

    @classmethod
    def complete_patient(cls, queue_id):
        """
        Manually marks a patient consultation as completed.
        """
        with queue_lock:
            entry = db.session.get(Queue, queue_id)
            if not entry or entry.status not in ['consulting', 'waiting', 'skipped']:
                return None
                
            cls._complete_patient_internal(entry)
            
            log = AuditLogs(
                action_type='complete_patient',
                description=f"Completed consultation for {entry.patient.name} (Token: {entry.token})"
            )
            db.session.add(log)
            
            notif = Notifications(
                message=f"Consultation completed: Token {entry.token}",
                type='info'
            )
            db.session.add(notif)
            
            db.session.commit()
            AiEngine.calculate_wait_times()
            return entry

    @classmethod
    def remove_patient(cls, queue_id):
        """
        Removes a patient from the active queue list.
        """
        with queue_lock:
            entry = db.session.get(Queue, queue_id)
            if not entry:
                return None
                
            entry.status = 'removed'
            entry.completed_at = datetime.utcnow()
            
            log = AuditLogs(
                action_type='remove_patient',
                description=f"Removed patient {entry.patient.name} (Token: {entry.token}) from queue"
            )
            db.session.add(log)
            
            db.session.commit()
            AiEngine.calculate_wait_times()
            return entry

    @classmethod
    def undo_last_action(cls):
        """
        Reverts the last queue action.
        """
        with queue_lock:
            # Find last audit log that is reversible
            reversible_actions = ['call_patient', 'skip_patient', 'complete_patient', 'remove_patient', 'add_patient']
            last_log = AuditLogs.query.filter(AuditLogs.action_type.in_(reversible_actions)).order_by(AuditLogs.id.desc()).first()
            
            if not last_log:
                return False
                
            action = last_log.action_type
            
            if action == 'add_patient':
                # Remove last queue entry
                last_queue = Queue.query.order_by(Queue.id.desc()).first()
                if last_queue:
                    # Remove notification too
                    last_notif = Notifications.query.order_by(Notifications.id.desc()).first()
                    if last_notif:
                        db.session.delete(last_notif)
                    db.session.delete(last_queue)
                    
            elif action == 'call_patient':
                # Revert Called Patient to Waiting
                called_patient = Queue.query.filter_by(status='consulting').first()
                if called_patient:
                    called_patient.status = 'waiting'
                    called_patient.called_at = None
                    
                # If a patient was auto-completed during Call Next, reverse them back to consulting
                # This would be the latest record in ConsultationHistory
                last_history = ConsultationHistory.query.order_by(ConsultationHistory.id.desc()).first()
                if last_history:
                    prev_completed = Queue.query.filter_by(token=last_history.token).first()
                    if prev_completed:
                        prev_completed.status = 'consulting'
                        prev_completed.completed_at = None
                    db.session.delete(last_history)
                    
            elif action == 'skip_patient':
                # Fetch last skipped patient
                last_skipped = Queue.query.filter_by(status='skipped').order_by(Queue.completed_at.desc()).first()
                if last_skipped:
                    last_skipped.status = 'waiting'
                    last_skipped.completed_at = None
                    
            elif action == 'complete_patient':
                # Revert Completed to Consulting/Waiting
                last_history = ConsultationHistory.query.order_by(ConsultationHistory.id.desc()).first()
                if last_history:
                    completed_patient = Queue.query.filter_by(token=last_history.token).first()
                    if completed_patient:
                        # Change back to consulting
                        completed_patient.status = 'consulting'
                        completed_patient.completed_at = None
                    db.session.delete(last_history)
                    
            elif action == 'remove_patient':
                # Revert Removed to Waiting
                last_removed = Queue.query.filter_by(status='removed').order_by(Queue.completed_at.desc()).first()
                if last_removed:
                    last_removed.status = 'waiting'
                    last_removed.completed_at = None
            
            # Delete the log entry
            db.session.delete(last_log)
            db.session.commit()
            
            # Recalculate wait times
            AiEngine.calculate_wait_times()
            return True

    @classmethod
    def reset_queue(cls):
        """
        Resets today's queue completely for a clean state.
        Wipes out Queue, ConsultationHistory, AuditLogs, and Notifications.
        Keep Patients register.
        """
        with queue_lock:
            # Delete active queue records
            db.session.query(Queue).delete()
            db.session.query(ConsultationHistory).delete()
            db.session.query(AuditLogs).delete()
            db.session.query(Notifications).delete()
            
            # Set default settings
            settings = Settings.query.first()
            if settings:
                settings.doctor_status = 'active'
                settings.doctor_speed = 'normal'
                settings.current_room = 'Consultation Room 1'
            else:
                settings = Settings()
                db.session.add(settings)
                
            db.session.commit()
            return True

    @staticmethod
    def _complete_patient_internal(queue_entry):
        """
        Internal helper: transitions a patient to complete and logs the duration in history.
        Must be called within a database session transaction block.
        """
        queue_entry.status = 'completed'
        queue_entry.completed_at = datetime.utcnow()
        queue_entry.position = 0
        
        # Calculate consultation duration in minutes
        duration = 10.0  # default fallback
        if queue_entry.called_at:
            delta = queue_entry.completed_at - queue_entry.called_at
            duration = max(1.0, round(delta.total_seconds() / 60.0, 1))
            
        history = ConsultationHistory(
            patient_id=queue_entry.patient_id,
            token=queue_entry.token,
            duration_minutes=duration,
            completed_at=queue_entry.completed_at
        )
        db.session.add(history)
