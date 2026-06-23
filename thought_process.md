# Thought Process & Architecture Decisions - Queue Cure AI 2.0

This document outlines the technical thought process, architectural design decisions, engineering trade-offs, and strategies implemented to make **Queue Cure AI 2.0** a production-ready SaaS product rather than a typical student hackathon project.

---

## 1. Real-Time Operations Architecture

### The Trade-off: Pure WebSockets vs. REST Mutations + WebSockets
Many real-time projects send mutation requests directly over WebSockets (e.g. sending a `call_next` socket payload). We chose a **hybrid model**:
- **REST APIs (HTTP POST/PUT/DELETE)** are used for all state mutation requests.
- **WebSockets (Socket.io)** are used exclusively to **broadcast state changes** down to connected clients.

**Why this decision?**
1. **Traceability**: REST endpoints provide HTTP status codes, standard validation messages, and are easier to protect with middleware/rate-limiters.
2. **Reliability**: Socket connections can drop. If a client submits a form via a socket while disconnected, the data is lost. Under REST, the browser handles standard HTTP timeouts and retries, and errors are handled deterministically.
3. **PWA & Mobile Friendliness**: Mobile devices suspend active WebSockets when locked. By using REST APIs for mutations, mobile users can safely submit registration forms or trigger actions, and then subscribe to the socket server only for real-time visual updates.

---

## 2. Concurrency and SQLite Thread Locks

In hospitals and clinics, multiple receptionists might trigger administrative operations (like "Call Next") simultaneously. SQLite is serverless and ordinarily permits only one writer at a time. If two threads write concurrently without coordination, database locking errors occur (`sqlite3.OperationalError: database is locked`).

### The Solution: Thread Lock Wrapper
To prevent race conditions and locking crashes, we wrapped all mutating operations in `backend/services/queue_manager.py` using a Python `threading.Lock()`:

```python
queue_lock = threading.Lock()

class QueueManager:
    @classmethod
    def call_next_patient(cls):
        with queue_lock:
            # Atomic database transaction here...
```

**How it works:**
- When a "Call Next" request is received, the thread acquires the lock.
- If a second receptionist sends a concurrent "Call Next" request, their thread is blocked until the first thread finishes writing, commits the transaction, and releases the lock.
- The second thread then safely runs on the updated database state (it will process the *subsequent* patient in line instead of the same one).
- This guarantees **zero token duplication** and **absolute transaction safety**.

---

## 3. Dynamic AI Wait Prediction Algorithm

Basic queue systems calculate wait time using a simple static formula:
$$\text{Wait} = \text{Patients Ahead} \times 10\text{ minutes}$$

We implemented a smart, multi-factor wait prediction engine:
1. **Dynamic Moving Average**: The system tracks the actual difference in minutes between the time a doctor calls a patient (`called_at`) and completes them (`completed_at`). The average of these durations forms the base consultation time ($T_{avg}$).
2. **Doctor Speed Multiplier**: A receptionist can configure doctor speed settings (`fast` = 0.8, `normal` = 1.0, `slow` = 1.3), which scales the base consultation unit.
3. **Time-of-Day Traffic Weight**: The algorithm increases predictions during morning rush hours (9 AM - 11 AM) and mid-afternoon lag hours (2 PM - 4 PM) based on statistical traffic logs.
4. **Emergency Priority Shifting**: Because emergency patients are automatically prioritized at the front of the queue, regular patients ahead count is dynamically offset, adjusting their estimations immediately.

---

## 4. UI/UX Design Decisions

To make the app look and feel premium (Stripe/Linear-grade), we avoided browser default styling:
- **HSL Tailwind Palettes**: Neutral slate backgrounds with deep indigo-blue brand colors, yielding high color contrast.
- **Glassmorphism**: Backdrop blur filters (`backdrop-filter`) for floating cards and navigation bars to provide depth.
- **Skeletons and Shimmers**: Prevents visual layout shifts (CLS) when data is being loaded over APIs.
- **Audio announcements**: Since browsers block media autoplay until user interaction, we default the patient TV monitor announcer to *muted*, displaying a clear, glowing button for the clinic manager to "Enable Voice Announcements". This guarantees the audio player starts successfully under browser security guidelines.
