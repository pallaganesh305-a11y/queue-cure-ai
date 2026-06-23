import pytest
from datetime import datetime, timedelta
from backend.app import app, db
from backend.database.models import Patients, Queue, Settings, ConsultationHistory, AuditLogs
from backend.services.ai_engine import AiEngine
from backend.services.queue_manager import QueueManager

@pytest.fixture
def client():
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    
    with app.test_client() as client:
        with app.app_context():
            db.create_all()
            # Seed default settings by modifying first row
            settings = Settings.query.first()
            if settings:
                settings.doctor_name = "Dr. Test Mercer"
                settings.doctor_status = "active"
                settings.doctor_speed = "normal"
                settings.fallback_avg_time = 10
                settings.current_room = "Test Room 1"
            else:
                settings = Settings(
                    doctor_name="Dr. Test Mercer",
                    doctor_status="active",
                    doctor_speed="normal",
                    fallback_avg_time=10,
                    current_room="Test Room 1"
                )
                db.session.add(settings)
            db.session.commit()
        yield client
        with app.app_context():
            db.drop_all()

def test_settings_api(client):
    # Test Get Settings
    res = client.get('/api/settings')
    assert res.status_code == 200
    data = res.get_json()
    assert data['doctor_name'] == "Dr. Test Mercer"
    assert data['doctor_status'] == "active"
    
    # Test Update Settings
    res_update = client.put('/api/settings', json={
        'doctor_name': 'Dr. House',
        'doctor_status': 'on_break',
        'doctor_speed': 'fast',
        'fallback_avg_time': 12,
        'current_room': 'Room 404'
    })
    assert res_update.status_code == 200
    data_update = res_update.get_json()
    assert data_update['doctor_name'] == 'Dr. House'
    assert data_update['doctor_status'] == 'on_break'
    assert data_update['doctor_speed'] == 'fast'
    assert data_update['fallback_avg_time'] == 12
    assert data_update['current_room'] == 'Room 404'

def test_register_patient_and_token_generation(client):
    # Register regular patient
    res1 = client.post('/api/patients', json={
        'name': 'John Doe',
        'age': 30,
        'gender': 'Male',
        'priority': 'medium',
        'consultation_type': 'consultation',
        'symptoms': 'Fever'
    })
    assert res1.status_code == 201
    p1 = res1.get_json()
    assert p1['token'] == 'QC-101'
    assert p1['status'] == 'waiting'
    
    # Register second regular patient
    res2 = client.post('/api/patients', json={
        'name': 'Jane Smith',
        'age': 25,
        'gender': 'Female',
        'priority': 'low'
    })
    assert res2.status_code == 201
    p2 = res2.get_json()
    assert p2['token'] == 'QC-102'
    
    # Register emergency patient
    res3 = client.post('/api/patients', json={
        'name': 'Critical Jack',
        'age': 50,
        'gender': 'Male',
        'priority': 'emergency',
        'symptoms': 'Chest pain'
    })
    assert res3.status_code == 201
    p3 = res3.get_json()
    assert p3['token'] == 'E-101'
    assert p3['priority'] == 'emergency'

def test_priority_sorting_and_wait_times(client):
    # Enqueue in this order: Regular 1, Regular 2, Emergency 1, Regular 3
    client.post('/api/patients', json={'name': 'Reg1', 'priority': 'medium'}) # QC-101
    client.post('/api/patients', json={'name': 'Reg2', 'priority': 'low'})    # QC-102
    client.post('/api/patients', json={'name': 'Emerg1', 'priority': 'emergency'}) # E-101
    client.post('/api/patients', json={'name': 'Reg3', 'priority': 'high'})   # QC-103
    
    res = client.get('/api/queue')
    assert res.status_code == 200
    queue = res.get_json()
    
    # Expected ordering: Emerg1 (priority), Reg1, Reg2, Reg3
    assert queue[0]['patient']['name'] == 'Emerg1'
    assert queue[1]['patient']['name'] == 'Reg1'
    assert queue[2]['patient']['name'] == 'Reg2'
    assert queue[3]['patient']['name'] == 'Reg3'
    
    # Check smart wait prediction
    avg_time = 10.0
    speed_mult = 1.0
    time_mult = AiEngine.get_time_of_day_multiplier()
    base_unit_time = avg_time * speed_mult * time_mult
    
    assert queue[0]['estimated_wait'] == 1
    assert queue[1]['estimated_wait'] == int(1 * base_unit_time)
    assert queue[2]['estimated_wait'] == int(2 * base_unit_time)

def test_call_next_cycle(client):
    # Enqueue patients
    client.post('/api/patients', json={'name': 'Alice', 'priority': 'medium'})
    client.post('/api/patients', json={'name': 'Bob', 'priority': 'emergency'})
    
    # Call Next (Should pull Bob because he is emergency)
    res_call1 = client.post('/api/queue/call-next')
    assert res_call1.status_code == 200
    bob_call = res_call1.get_json()
    assert bob_call['patient']['name'] == 'Bob'
    assert bob_call['status'] == 'consulting'
    assert bob_call['called_at'] is not None
    
    # Call Next again (Should complete Bob, and call Alice)
    res_call2 = client.post('/api/queue/call-next')
    assert res_call2.status_code == 200
    alice_call = res_call2.get_json()
    assert alice_call['patient']['name'] == 'Alice'
    assert alice_call['status'] == 'consulting'
    
    # Verify Bob is now completed in history
    res_history = client.get('/api/history')
    history = res_history.get_json()
    assert len(history) == 1
    assert history[0]['token'] == bob_call['token']
    assert history[0]['status'] == 'completed'

def test_skip_and_complete_apis(client):
    # Enqueue patient
    res_add = client.post('/api/patients', json={'name': 'Charlie', 'priority': 'medium'})
    q_id = res_add.get_json()['id']
    
    # Skip patient
    res_skip = client.post(f'/api/queue/skip/{q_id}')
    assert res_skip.status_code == 200
    assert res_skip.get_json()['status'] == 'skipped'
    
    # Complete patient (directly from skipped status)
    res_comp = client.post(f'/api/queue/complete/{q_id}')
    assert res_comp.status_code == 200
    assert res_comp.get_json()['status'] == 'completed'

def test_undo_last_action(client):
    # Enqueue a patient
    res_add = client.post('/api/patients', json={'name': 'Diana', 'priority': 'medium'})
    q_id = res_add.get_json()['id']
    
    # Call patient
    client.post('/api/queue/call-next')
    
    # Verify patient is consulting
    res_queue = client.get('/api/queue')
    assert res_queue.get_json()[0]['status'] == 'consulting'
    
    # Undo Call
    res_undo = client.post('/api/queue/undo')
    assert res_undo.status_code == 200
    
    # Verify patient goes back to waiting
    res_queue2 = client.get('/api/queue')
    assert res_queue2.get_json()[0]['status'] == 'waiting'

def test_ai_chatbot_assistant(client):
    # Register 1 waiting patient
    client.post('/api/patients', json={'name': 'Eva', 'priority': 'medium'})
    
    # Test chat endpoint
    res_chat = client.post('/api/ai/chat', json={'message': 'how many patients are waiting?'})
    assert res_chat.status_code == 200
    assert "1 patients waiting" in res_chat.get_json()['response']
    
    res_longest = client.post('/api/ai/chat', json={'message': 'who has waited the longest?'})
    assert res_longest.status_code == 200
    assert "Eva" in res_longest.get_json()['response']
