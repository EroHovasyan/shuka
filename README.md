# Shuka — Full-stack marketplace starter

A runnable MVP starter for the Shuka PRD: React/Vite frontend, Express API, SQLite database, buyer/seller accounts, product listings, cart, Cash on Delivery checkout, and order management.

## Requirements
- Node.js 20+
- npm

## Run locally

### 1. Backend
```bash
cd server
cp .env.example .env
npm install
npm run dev
```
API runs at `http://localhost:4000`. SQLite and uploaded images are stored in `server/data/` locally.

### 2. Frontend
In another terminal:
```bash
cd client
npm install
npm run dev
```
Open the Vite URL (normally `http://localhost:5173`).

Create an account, then use the **Become a seller** action to enable seller tools. For production, configure a proper JWT secret and HTTPS.

## Deployment

### Render (backend)
- Create a **Web Service** from this repository.
- Root directory: `server`
- Build command: `npm install`
- Start command: `npm start`
- Add a persistent disk mounted at `/var/data`.
- Set environment variables:
  - `NODE_ENV=production`
  - `PORT=10000`
  - `JWT_SECRET` to a long random secret
  - `DB_PATH=/var/data/shuka.sqlite`
  - `UPLOAD_DIR=/var/data/uploads`
  - `CLIENT_ORIGIN=https://YOUR-NETLIFY-SITE.netlify.app`
- Health check path: `/api/health`

### Netlify (frontend)
- Base directory: `client`
- Build command: `npm run build`
- Publish directory: `dist`
- Set `VITE_API_BASE=/api`
- Configure a Netlify rewrite/proxy for `/api/*` to your Render service, or set `VITE_API_BASE` to the full Render URL. If using the Render URL directly, configure `CLIENT_ORIGIN` to your Netlify domain.

## Important MVP limitations
This is a foundation, not a production-audited commerce platform. Before launch, add email verification/password reset, rate limiting, CSRF protection appropriate to your auth strategy, payment-provider integration if needed, automated backups, image moderation, audit logging, and a full test suite. SQLite is intended for a single backend instance with persistent disk; do not scale the Render service horizontally while using this database.
