# Production Deployment Guide - Queue Cure AI 2.0

This guide details how to deploy the **Queue Cure AI 2.0** application to cloud hosting platforms: the backend on **Render** (Python/Flask) and the frontend on **Vercel** (Vite/React).

---

## 1. Backend Deployment (Render)

Render is ideal for hosting our Flask-SocketIO backend because it supports persistent WebSocket connections.

### Steps:
1. Sign in to your [Render Dashboard](https://render.com).
2. Click **New** $\rightarrow$ **Web Service**.
3. Connect your Git repository.
4. Configure the service:
   - **Name**: `queue-cure-backend`
   - **Environment**: `Python 3`
   - **Region**: Select the region closest to your users.
   - **Branch**: `main`
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `gunicorn --worker-class eventlet -w 1 backend.app:app` 
     *(Note: If eventlet is not used, standard threading can be used, but eventlet or gevent is recommended for high concurrency production websockets).*
5. Expand the **Advanced** section and add **Environment Variables**:
   - `SECRET_KEY`: A strong random string (e.g. `your-random-production-key`)
   - `DATABASE_URL`: `sqlite:///backend/instance/queue_cure.db`
6. Click **Create Web Service**. Note the production URL (e.g., `https://queue-cure-backend.onrender.com`).

---

## 2. Frontend Deployment (Vercel)

Vercel is optimized for building and serving static frontend assets. We will use a `vercel.json` config file to proxy requests from the frontend domain to our Render backend, avoiding CORS preflight blockages.

### Step 2.1: Add `vercel.json` to the frontend root
Create a file named `frontend/vercel.json` containing:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://queue-cure-backend.onrender.com/api/:path*"
    },
    {
      "source": "/socket.io/:path*",
      "destination": "https://queue-cure-backend.onrender.com/socket.io/:path*"
    }
  ]
}
```
*(Replace `https://queue-cure-backend.onrender.com` with your actual Render URL).*

### Step 2.2: Deploy on Vercel
1. Sign in to your [Vercel Dashboard](https://vercel.com).
2. Click **Add New** $\rightarrow$ **Project**.
3. Import your Git repository.
4. Configure the settings:
   - **Root Directory**: `frontend`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Click **Deploy**. Vercel will transpile, package, and host your static app at a custom subdomain.

---

## 3. Production Environment Checklist
- [ ] Verify that HTTP and Socket requests do not trigger CORS preflight blockages.
- [ ] Toggle doctor status on the dashboard; confirm the patient TV screen updates instantly.
- [ ] Confirm TTS announcement reads tokens aloud on the TV screen in production.
