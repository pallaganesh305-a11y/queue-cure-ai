from datetime import datetime
from sqlalchemy import func
from backend.database.db import db
from backend.database.models import Patients, Queue, ConsultationHistory, Settings

class AiEngine:
    @staticmethod
    def get_average_consultation_time():
        """
        Calculate the average consultation time based on completed visits today.
        If no visits are completed today, fall back to the doctor's default setting.
        """
        # Fetch today's completed consultations
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        
        avg_dur = db.session.query(func.avg(ConsultationHistory.duration_minutes))\
            .filter(ConsultationHistory.completed_at >= today_start).scalar()
            
        if avg_dur is not None and avg_dur > 0:
            return round(float(avg_dur), 1)
            
        # Fall back to settings
        settings = Settings.query.first()
        if settings:
            return float(settings.fallback_avg_time)
        return 10.0

    @staticmethod
    def get_doctor_speed_multiplier():
        """
        Get the doctor's processing speed multiplier.
        """
        settings = Settings.query.first()
        if not settings:
            return 1.0
            
        speed = settings.doctor_speed
        if speed == 'fast':
            return 0.8
        elif speed == 'slow':
            return 1.3
        return 1.0  # normal

    @staticmethod
    def get_time_of_day_multiplier():
        """
        Get traffic multiplier based on the current hour of the day.
        Morning rush (09:00 - 11:00) and Afternoon rush (14:00 - 16:00) have higher weight.
        """
        current_hour = datetime.now().hour
        if 9 <= current_hour <= 11:
            return 1.15
        elif 14 <= current_hour <= 16:
            return 1.10
        return 1.0

    @classmethod
    def calculate_wait_times(cls):
        """
        Calculate smart estimated wait times for all waiting patients.
        Updates the estimate dynamically based on position and priority.
        """
        # Get active queue
        # Queue ordering:
        # 1. Status 'consulting' (goes first, wait time = 0)
        # 2. Status 'waiting' & priority 'emergency' (ordered by joined_at)
        # 3. Status 'waiting' & priority != 'emergency' (ordered by joined_at)
        # 4. Status 'skipped' (treated as on hold)
        
        all_active = Queue.query.filter(Queue.status.in_(['waiting', 'consulting', 'skipped'])).all()
        
        # Sort manually to ensure absolute consistency
        consulting = [q for q in all_active if q.status == 'consulting']
        waiting_emergency = sorted([q for q in all_active if q.status == 'waiting' and q.priority == 'emergency'], key=lambda x: x.joined_at)
        waiting_normal = sorted([q for q in all_active if q.status == 'waiting' and q.priority != 'emergency'], key=lambda x: x.joined_at)
        skipped = [q for q in all_active if q.status == 'skipped']
        
        ordered_waiting = waiting_emergency + waiting_normal
        
        avg_time = cls.get_average_consultation_time()
        speed_mult = cls.get_doctor_speed_multiplier()
        time_mult = cls.get_time_of_day_multiplier()
        
        base_unit_time = max(1.0, avg_time * speed_mult * time_mult)
        
        predictions = {}
        
        # Consulting patient is currently inside. Wait time is 0.
        for q in consulting:
            predictions[q.id] = 0
            q.position = 0
            
        # Waiting patients
        for index, q in enumerate(ordered_waiting):
            position = index + 1
            q.position = position
            
            # Estimated wait: Patients ahead * base_unit_time
            # For emergency patients, they bypass normal waiting patients, which is handled automatically
            # because they are sorted first in ordered_waiting list.
            patients_ahead = index
            wait_time = int(patients_ahead * base_unit_time)
            
            # If there is currently someone in consultation, add half of the base unit time as remaining wait
            if consulting:
                wait_time += int(base_unit_time * 0.5)
                
            predictions[q.id] = max(1, wait_time)
            
        # Skipped patients (On hold)
        for q in skipped:
            predictions[q.id] = -1  # Represents "On Hold"
            q.position = 999  # Sent to end
            
        db.session.commit()
        return predictions

    @classmethod
    def get_queue_health(cls):
        """
        Evaluate queue status and return health category and recommendations.
        """
        waiting_count = Queue.query.filter_by(status='waiting').count()
        emergency_count = Queue.query.filter_by(status='waiting', priority='emergency').count()
        avg_time = cls.get_average_consultation_time()
        
        settings = Settings.query.first()
        doctor_offline = settings.doctor_status == 'offline' if settings else False
        
        if doctor_offline:
            return {
                'status': 'Inactive',
                'color': 'gray',
                'score': 0,
                'recommendation': 'Doctor is offline. Patients are waiting but cannot be called. Please update doctor status.'
            }
            
        total_estimated_wait = waiting_count * avg_time * cls.get_doctor_speed_multiplier()
        
        if waiting_count == 0:
            return {
                'status': 'Healthy',
                'color': 'emerald',
                'score': 100,
                'recommendation': 'No patients waiting. The system is clear and ready for new registrations.'
            }
        elif emergency_count > 0 or waiting_count >= 10 or total_estimated_wait > 45:
            return {
                'status': 'Overloaded',
                'color': 'rose',
                'score': 30,
                'recommendation': f'Queue is overloaded. {emergency_count} emergency patient(s) waiting. Consider triage escalation or secondary doctor routing.'
            }
        elif waiting_count >= 5 or total_estimated_wait > 20:
            return {
                'status': 'Busy',
                'color': 'amber',
                'score': 65,
                'recommendation': 'Queue is busy. Suggest keeping consultation durations compact to prevent patient backlog.'
            }
        else:
            return {
                'status': 'Healthy',
                'color': 'emerald',
                'score': 90,
                'recommendation': 'Queue flow is healthy. Wait times are well within acceptable clinic standards.'
            }

    @classmethod
    def generate_chat_response(cls, message):
        """
        AI Receptionist chatbot assistant.
        Parses text and answers administrative queries dynamically based on current queue metrics.
        """
        message = message.lower().strip()
        
        # Fetch stats
        waiting_patients = Queue.query.filter_by(status='waiting').all()
        waiting_count = len(waiting_patients)
        consulting_patient = Queue.query.filter_by(status='consulting').first()
        completed_count = Queue.query.filter_by(status='completed').count()
        skipped_count = Queue.query.filter_by(status='skipped').count()
        avg_time = cls.get_average_consultation_time()
        health = cls.get_queue_health()
        
        # 1. Query: Longest Wait
        if any(x in message for x in ['longest', 'long wait', 'waited the longest', 'longest waiting']):
            if not waiting_patients:
                return "There are currently no patients waiting in the queue."
            
            # Longest waiting is the one with status='waiting' and oldest joined_at
            longest_wait = sorted(waiting_patients, key=lambda x: x.joined_at)[0]
            wait_duration = int((datetime.utcnow() - longest_wait.joined_at).total_seconds() / 60)
            return (
                f"The patient who has been waiting the longest is **{longest_wait.patient.name}** "
                f"(Token: **{longest_wait.token}**, Priority: **{longest_wait.priority}**). "
                f"They joined **{wait_duration} minutes ago**."
            )
            
        # 2. Query: Waiting Count
        elif any(x in message for x in ['how many waiting', 'how many patients are waiting', 'waiting count', 'queue size', 'number of waiting']):
            if waiting_count == 0:
                return "There are no patients waiting in the queue right now."
            emergency_count = sum(1 for p in waiting_patients if p.priority == 'emergency')
            emergency_str = f" (including **{emergency_count} emergency** cases)" if emergency_count > 0 else ""
            return f"There are currently **{waiting_count} patients waiting** in the queue{emergency_str}."

        # 3. Query: Average Consultation Time
        elif any(x in message for x in ['average consultation', 'avg consultation', 'consultation duration', 'consultation time']):
            completed_today = ConsultationHistory.query.count()
            if completed_today == 0:
                return f"No consultations have been completed today yet. The fallback average consultation time is set to **{avg_time} minutes**."
            return f"Today's dynamic average consultation duration is **{avg_time} minutes**, calculated from **{completed_today} completed** visits."

        # 4. Query: Why is wait time increasing / high?
        elif any(x in message for x in ['why is wait', 'why is it increasing', 'why the delay', 'reasons for wait']):
            reasons = []
            emergency_waiting = sum(1 for p in waiting_patients if p.priority == 'emergency')
            settings = Settings.query.first()
            
            if emergency_waiting > 0:
                reasons.append(f"There are **{emergency_waiting} emergency patients** waiting. Emergency cases bypass regular patients, shifting their schedules.")
            if settings and settings.doctor_speed == 'slow':
                reasons.append("The doctor's consultation speed is set to **'slow'** (1.3x duration multiplier).")
            if settings and settings.doctor_status == 'on_break':
                reasons.append("The doctor is currently **on break**, which has paused all active call-outs.")
            if waiting_count > 8:
                reasons.append(f"High patient load. There are **{waiting_count} active waiting patients** causing a backlog.")
                
            if not reasons:
                return "Wait times are stable and the queue is healthy. There are no outstanding delays at the moment."
                
            response = "Wait times are elevated due to the following factors:\n"
            for i, reason in enumerate(reasons, 1):
                response += f"{i}. {reason}\n"
            return response.strip()

        # 5. Query: Emergency count
        elif any(x in message for x in ['emergency', 'critical patients', 'how many emergencies']):
            emergency_waiting = sum(1 for p in waiting_patients if p.priority == 'emergency')
            if emergency_waiting == 0:
                return "Great news: there are no emergency patients waiting in the queue right now."
            return f"There are **{emergency_waiting} emergency patients** waiting. They will be called immediately next."

        # 6. Query: Doctor Status
        elif any(x in message for x in ['doctor', 'dr.', 'is the doctor', 'doctor status', 'physician']):
            settings = Settings.query.first()
            if not settings:
                return "Doctor status is currently unavailable."
            status = settings.doctor_status.replace('_', ' ').title()
            room = settings.current_room
            speed = settings.doctor_speed.title()
            return f"**{settings.doctor_name}** is currently **{status}** in **{room}** (Consultation Speed: **{speed}**)."

        # 7. Query: Stats / Overview
        elif any(x in message for x in ['status', 'summary', 'overview', 'how is the queue', 'analytics']):
            return (
                f"### Clinic Queue Overview:\n"
                f"- **Waiting Patients**: {waiting_count}\n"
                f"- **In Consultation**: {f'**{consulting_patient.patient.name}** ({consulting_patient.token})' if consulting_patient else 'None'}\n"
                f"- **Completed Consultations**: {completed_count}\n"
                f"- **Skipped Patients**: {skipped_count}\n"
                f"- **Queue Health**: **{health['status']}** ({health['recommendation']})"
            )
            
        # Default fallback response
        return (
            "Hello! I am your AI Clinic Assistant. You can ask me questions like:\n"
            "- *How many patients are waiting?*\n"
            "- *Who has been waiting the longest?*\n"
            "- *What is the average consultation duration?*\n"
            "- *Why is the wait time increasing?*\n"
            "- *What is the doctor's current status?*"
        )

    @classmethod
    def generate_daily_insights(cls):
        """
        AI Analytics engine to output daily summary reports.
        """
        total_patients = Patients.query.count()
        completed = Queue.query.filter_by(status='completed').all()
        completed_count = len(completed)
        skipped_count = Queue.query.filter_by(status='skipped').count()
        emergency_count = Queue.query.filter(Queue.priority == 'emergency').count()
        
        # Common consultation type
        common_type = db.session.query(Queue.consultation_type, func.count(Queue.consultation_type))\
            .group_by(Queue.consultation_type)\
            .order_by(func.count(Queue.consultation_type).desc()).first()
            
        common_type_str = common_type[0].replace('_', ' ').title() if common_type else "None"
        
        # Longest Wait
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        completed_history = ConsultationHistory.query.filter(ConsultationHistory.completed_at >= today_start).all()
        max_wait = max([c.duration_minutes for c in completed_history]) if completed_history else 0.0
        
        # Busiest Hour
        busiest_hour_query = db.session.query(
            func.strftime('%H', Queue.joined_at).label('hour'),
            func.count(Queue.id).label('count')
        ).group_by('hour').order_by(func.count(Queue.id).desc()).first()
        
        busiest_hour_str = f"{busiest_hour_query[0]}:00" if busiest_hour_query else "N/A"
        
        return {
            'peak_hour': busiest_hour_str,
            'avg_consultation_time': cls.get_average_consultation_time(),
            'longest_wait': round(max_wait, 1),
            'busiest_day': datetime.now().strftime('%A'),
            'most_common_type': common_type_str,
            'completion_rate': round((completed_count / total_patients * 100), 1) if total_patients > 0 else 0.0,
            'summary_text': f"Today's peak traffic occurred around {busiest_hour_str}. The clinic processed {completed_count} patients with a completion rate of {round((completed_count / total_patients * 100), 1) if total_patients > 0 else 0}%."
        }
