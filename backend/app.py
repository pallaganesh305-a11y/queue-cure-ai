import os
from datetime import datetime
from sqlalchemy import func
from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit
from flask_cors import CORS

from backend.config import Config
from backend.database.db import db
from backend.database.models import Patients, Queue, ConsultationHistory, Settings, AuditLogs, Notifications
from backend.services.ai_engine import AiEngine
from backend.services.queue_manager import QueueManager

# Create instance folder if not exists
instance_path = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'instance')
os.makedirs(instance_path, exist_ok=True)

app = Flask(__name__, instance_path=instance_path)
app.config.from_object(Config)

# Enable CORS
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Initialize Flask-SocketIO
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Initialize DB
db.init_app(app)

def broadcast_queue_update(event_to_trigger=None, extra_payload=None):
    """
    Recalculates wait times and broadcasts the updated queue, statistics,
    and notifications to all connected WebSockets.
    """
    # Recalculate wait times
    predictions = AiEngine.calculate_wait_times()
    
    # Query current queue
    active_entries = Queue.query.filter(Queue.status.in_(['waiting', 'consulting', 'skipped'])).all()
    
    # Order manually for strict client interface consistency
    consulting = sorted([e for e in active_entries if e.status == 'consulting'], key=lambda x: x.called_at or x.joined_at)
    waiting_emergency = sorted([e for e in active_entries if e.status == 'waiting' and e.priority == 'emergency'], key=lambda x: x.joined_at)
    waiting_normal = sorted([e for e in active_entries if e.status == 'waiting' and e.priority != 'emergency'], key=lambda x: x.joined_at)
    skipped = sorted([e for e in active_entries if e.status == 'skipped'], key=lambda x: x.completed_at or x.joined_at)
    
    ordered_queue = consulting + waiting_emergency + waiting_normal + skipped
    
    queue_list = []
    for q in ordered_queue:
        q_dict = q.to_dict()
        q_dict['estimated_wait'] = predictions.get(q.id, 0)
        queue_list.append(q_dict)
        
    # Get stats
    waiting_count = len(waiting_emergency) + len(waiting_normal)
    completed_count = Queue.query.filter_by(status='completed').count()
    
    settings = Settings.query.first()
    doctor_name = settings.doctor_name if settings else "Dr. Alex Mercer"
    doctor_status = settings.doctor_status if settings else "active"
    doctor_speed = settings.doctor_speed if settings else "normal"
    current_room = settings.current_room if settings else "Consultation Room 1"
    fallback_time = settings.fallback_avg_time if settings else 10
    
    avg_consultation = AiEngine.get_average_consultation_time()
    
    # Total wait time for the next incoming patient
    speed_mult = AiEngine.get_doctor_speed_multiplier()
    time_mult = AiEngine.get_time_of_day_multiplier()
    total_wait = int(waiting_count * avg_consultation * speed_mult * time_mult)
    
    # Queue Health
    health = AiEngine.get_queue_health()
    
    # Latest 10 Notifications
    notifs = Notifications.query.order_by(Notifications.id.desc()).limit(10).all()
    notif_list = [n.to_dict() for n in notifs]
    
    payload = {
        'queue': queue_list,
        'stats': {
            'waiting_count': waiting_count,
            'completed_count': completed_count,
            'skipped_count': len(skipped),
            'current_token': consulting[0].token if consulting else "N/A",
            'current_patient': consulting[0].patient.name if consulting else "N/A",
            'average_consultation': avg_consultation,
            'total_wait_estimate': total_wait,
            'doctor_name': doctor_name,
            'doctor_status': doctor_status,
            'doctor_speed': doctor_speed,
            'current_room': current_room,
            'queue_health': health
        },
        'notifications': notif_list
    }
    
    # Broadcast to all
    socketio.emit('queue_updated', payload)
    
    # Optional trigger of secondary actions
    if event_to_trigger and extra_payload:
        socketio.emit(event_to_trigger, extra_payload)
        
    return payload

# Database setup check
with app.app_context():
    db.create_all()
    # Initialize default settings if not exists
    if not Settings.query.first():
        default_settings = Settings()
        db.session.add(default_settings)
        db.session.commit()

# --- SOCKET.IO HANDLERS ---

@socketio.on('connect')
def handle_connect():
    print(f"Client connected: {request.sid}")
    # Immediately send the current state to the connected client
    try:
        predictions = AiEngine.calculate_wait_times()
        active_entries = Queue.query.filter(Queue.status.in_(['waiting', 'consulting', 'skipped'])).all()
        
        consulting = sorted([e for e in active_entries if e.status == 'consulting'], key=lambda x: x.called_at or x.joined_at)
        waiting_emergency = sorted([e for e in active_entries if e.status == 'waiting' and e.priority == 'emergency'], key=lambda x: x.joined_at)
        waiting_normal = sorted([e for e in active_entries if e.status == 'waiting' and e.priority != 'emergency'], key=lambda x: x.joined_at)
        skipped = sorted([e for e in active_entries if e.status == 'skipped'], key=lambda x: x.completed_at or x.joined_at)
        
        ordered_queue = consulting + waiting_emergency + waiting_normal + skipped
        
        queue_list = []
        for q in ordered_queue:
            q_dict = q.to_dict()
            q_dict['estimated_wait'] = predictions.get(q.id, 0)
            queue_list.append(q_dict)
            
        waiting_count = len(waiting_emergency) + len(waiting_normal)
        completed_count = Queue.query.filter_by(status='completed').count()
        
        settings = Settings.query.first()
        
        avg_consultation = AiEngine.get_average_consultation_time()
        speed_mult = AiEngine.get_doctor_speed_multiplier()
        time_mult = AiEngine.get_time_of_day_multiplier()
        total_wait = int(waiting_count * avg_consultation * speed_mult * time_mult)
        
        health = AiEngine.get_queue_health()
        notifs = Notifications.query.order_by(Notifications.id.desc()).limit(10).all()
        
        emit('queue_updated', {
            'queue': queue_list,
            'stats': {
                'waiting_count': waiting_count,
                'completed_count': completed_count,
                'skipped_count': len(skipped),
                'current_token': consulting[0].token if consulting else "N/A",
                'current_patient': consulting[0].patient.name if consulting else "N/A",
                'average_consultation': avg_consultation,
                'total_wait_estimate': total_wait,
                'doctor_name': settings.doctor_name if settings else "Dr. Alex Mercer",
                'doctor_status': settings.doctor_status if settings else "active",
                'doctor_speed': settings.doctor_speed if settings else "normal",
                'current_room': settings.current_room if settings else "Consultation Room 1",
                'queue_health': health
            },
            'notifications': [n.to_dict() for n in notifs]
        })
    except Exception as e:
        print(f"Error on socket connect send: {e}")

@socketio.on('disconnect')
def handle_disconnect():
    print(f"Client disconnected: {request.sid}")

# --- REST API ROUTES ---

@app.route('/api/settings', methods=['GET'])
def get_settings():
    settings = Settings.query.first()
    return jsonify(settings.to_dict() if settings else {})

@app.route('/api/settings', methods=['PUT'])
def update_settings():
    data = request.json
    settings = Settings.query.first()
    if not settings:
        settings = Settings()
        db.session.add(settings)
        
    old_status = settings.doctor_status
    
    settings.doctor_name = data.get('doctor_name', settings.doctor_name)
    settings.doctor_status = data.get('doctor_status', settings.doctor_status)
    settings.doctor_speed = data.get('doctor_speed', settings.doctor_speed)
    settings.fallback_avg_time = int(data.get('fallback_avg_time', settings.fallback_avg_time))
    settings.current_room = data.get('current_room', settings.current_room)
    
    db.session.commit()
    
    # Log audit
    log = AuditLogs(
        action_type='change_settings',
        description=f"Updated doctor settings. Status: {settings.doctor_status}, Speed: {settings.doctor_speed}"
    )
    db.session.add(log)
    db.session.commit()
    
    # Broadcast updates
    broadcast_queue_update()
    
    return jsonify(settings.to_dict())

@app.route('/api/patients', methods=['POST'])
def add_patient():
    data = request.json
    name = data.get('name')
    if not name:
        return jsonify({'error': 'Patient name is required'}), 400
        
    age = data.get('age')
    gender = data.get('gender', 'Other')
    phone = data.get('phone', '')
    email = data.get('email', '')
    symptoms = data.get('symptoms', '')
    priority = data.get('priority', 'medium')  # low, medium, high, emergency
    consultation_type = data.get('consultation_type', 'consultation')
    notes = data.get('notes', '')
    
    try:
        queue_entry = QueueManager.add_patient_to_queue(
            name=name, age=age, gender=gender, phone=phone, email=email,
            symptoms=symptoms, priority=priority, consultation_type=consultation_type, notes=notes
        )
        
        broadcast_queue_update()
        return jsonify(queue_entry.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/queue', methods=['GET'])
def get_queue():
    # Calling wait_times triggers updates, then queries
    predictions = AiEngine.calculate_wait_times()
    active_entries = Queue.query.filter(Queue.status.in_(['waiting', 'consulting', 'skipped'])).all()
    
    consulting = sorted([e for e in active_entries if e.status == 'consulting'], key=lambda x: x.called_at or x.joined_at)
    waiting_emergency = sorted([e for e in active_entries if e.status == 'waiting' and e.priority == 'emergency'], key=lambda x: x.joined_at)
    waiting_normal = sorted([e for e in active_entries if e.status == 'waiting' and e.priority != 'emergency'], key=lambda x: x.joined_at)
    skipped = sorted([e for e in active_entries if e.status == 'skipped'], key=lambda x: x.completed_at or x.joined_at)
    
    ordered_queue = consulting + waiting_emergency + waiting_normal + skipped
    
    queue_list = []
    for q in ordered_queue:
        q_dict = q.to_dict()
        q_dict['estimated_wait'] = predictions.get(q.id, 0)
        queue_list.append(q_dict)
        
    return jsonify(queue_list)

@app.route('/api/queue/<int:queue_id>', methods=['PUT'])
def edit_queue_patient(queue_id):
    data = request.json
    entry = Queue.query.get(queue_id)
    if not entry:
        return jsonify({'error': 'Queue record not found'}), 404
        
    # Edit patient details
    patient = entry.patient
    if patient:
        patient.name = data.get('name', patient.name)
        patient.age = data.get('age', patient.age)
        patient.gender = data.get('gender', patient.gender)
        patient.phone = data.get('phone', patient.phone)
        patient.email = data.get('email', patient.email)
        patient.symptoms = data.get('symptoms', patient.symptoms)
        
    # Edit queue details
    entry.priority = data.get('priority', entry.priority)
    entry.consultation_type = data.get('consultation_type', entry.consultation_type)
    entry.notes = data.get('notes', entry.notes)
    
    db.session.commit()
    
    broadcast_queue_update()
    return jsonify(entry.to_dict())

@app.route('/api/queue/<int:queue_id>', methods=['DELETE'])
def remove_queue_patient(queue_id):
    result = QueueManager.remove_patient(queue_id)
    if not result:
        return jsonify({'error': 'Queue record not found'}), 404
        
    broadcast_queue_update()
    return jsonify({'success': True, 'removed': result.token})

@app.route('/api/queue/call-next', methods=['POST'])
def call_next():
    called = QueueManager.call_next_patient()
    if not called:
        return jsonify({'message': 'No patients waiting in queue'}), 200
        
    settings = Settings.query.first()
    room = settings.current_room if settings else "Consultation Room 1"
    
    # Broadcast dynamic announcement trigger
    broadcast_queue_update(
        event_to_trigger='patient_called',
        extra_payload={
            'token': called.token,
            'name': called.patient.name,
            'room': room
        }
    )
    
    return jsonify(called.to_dict())

@app.route('/api/queue/skip/<int:queue_id>', methods=['POST'])
def skip_patient(queue_id):
    skipped = QueueManager.skip_patient(queue_id)
    if not skipped:
        return jsonify({'error': 'Patient cannot be skipped (not waiting or not found)'}), 400
        
    broadcast_queue_update()
    return jsonify(skipped.to_dict())

@app.route('/api/queue/complete/<int:queue_id>', methods=['POST'])
def complete_patient(queue_id):
    completed = QueueManager.complete_patient(queue_id)
    if not completed:
        return jsonify({'error': 'Patient cannot be completed'}), 400
        
    broadcast_queue_update()
    return jsonify(completed.to_dict())

@app.route('/api/queue/undo', methods=['POST'])
def undo_action():
    success = QueueManager.undo_last_action()
    if not success:
        return jsonify({'error': 'No reversible actions found'}), 400
        
    broadcast_queue_update()
    return jsonify({'success': True})

@app.route('/api/queue/reset', methods=['POST'])
def reset_queue():
    success = QueueManager.reset_queue()
    if not success:
        return jsonify({'error': 'Failed to reset queue'}), 500
        
    broadcast_queue_update()
    return jsonify({'success': True})

@app.route('/api/ai/chat', methods=['POST'])
def ai_chat():
    data = request.json
    message = data.get('message')
    if not message:
        return jsonify({'error': 'Message parameter is empty'}), 400
        
    response_text = AiEngine.generate_chat_response(message)
    return jsonify({'response': response_text})

@app.route('/api/history', methods=['GET'])
def get_history():
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    history_entries = Queue.query.filter(
        Queue.status.in_(['completed', 'skipped', 'removed']),
        Queue.joined_at >= today_start
    ).order_by(Queue.completed_at.desc()).all()
    
    return jsonify([h.to_dict() for h in history_entries])

@app.route('/api/notifications', methods=['GET'])
def get_notifications():
    notifs = Notifications.query.order_by(Notifications.id.desc()).limit(30).all()
    return jsonify([n.to_dict() for n in notifs])

@app.route('/api/notifications/read', methods=['POST'])
def mark_notifications_read():
    Notifications.query.filter_by(is_read=False).update({Notifications.is_read: True})
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/analytics', methods=['GET'])
def get_analytics():
    # 1. AI Daily Insights
    insights = AiEngine.generate_daily_insights()
    
    # 2. Hourly Wait Time / Completion Trend
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Completed consultations hourly split
    completed_consultations = ConsultationHistory.query.filter(
        ConsultationHistory.completed_at >= today_start
    ).all()
    
    hourly_data = {}
    # Prefill all business hours (9am to 6pm)
    for hour in range(9, 19):
        hourly_data[f"{hour:02d}:00"] = {'hour': f"{hour:02d}:00", 'served': 0, 'avg_duration': 0.0, 'temp_durations': []}
        
    for c in completed_consultations:
        local_hour = c.completed_at.hour
        hour_str = f"{local_hour:02d}:00"
        if hour_str not in hourly_data:
            hourly_data[hour_str] = {'hour': hour_str, 'served': 0, 'avg_duration': 0.0, 'temp_durations': []}
        hourly_data[hour_str]['served'] += 1
        hourly_data[hour_str]['temp_durations'].append(c.duration_minutes)
        
    for hour, h_data in hourly_data.items():
        if h_data['temp_durations']:
            h_data['avg_duration'] = round(sum(h_data['temp_durations']) / len(h_data['temp_durations']), 1)
        del h_data['temp_durations']
        
    # Sort hourly trend
    sorted_hourly = [hourly_data[k] for k in sorted(hourly_data.keys())]
    
    # 3. Consultation Type split (Pie Chart)
    consultation_split = db.session.query(
        Queue.consultation_type,
        func.count(Queue.id)
    ).group_by(Queue.consultation_type).all()
    
    type_data = []
    for row in consultation_split:
        type_data.append({
            'name': row[0].replace('_', ' ').title(),
            'value': row[1]
        })
        
    # 4. Priority split
    priority_split = db.session.query(
        Queue.priority,
        func.count(Queue.id)
    ).group_by(Queue.priority).all()
    
    priority_data = []
    for row in priority_split:
        priority_data.append({
            'name': row[0].title(),
            'value': row[1]
        })
        
    # 5. Peak Hours / Queue Depth Trend
    # Query queue joined_at hour counts
    joins_by_hour = db.session.query(
        func.strftime('%H', Queue.joined_at).label('hour'),
        func.count(Queue.id).label('count')
    ).group_by('hour').all()
    
    peak_hours_data = []
    for row in joins_by_hour:
        peak_hours_data.append({
            'hour': f"{int(row[0]):02d}:00",
            'patients': row[1]
        })
    # Sort by hour
    peak_hours_data = sorted(peak_hours_data, key=lambda x: x['hour'])
        
    payload = {
        'insights': insights,
        'hourly_trend': sorted_hourly,
        'types_distribution': type_data,
        'priority_distribution': priority_data,
        'peak_hours': peak_hours_data
    }
    
    return jsonify(payload)

# Run standard dev server
if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)
