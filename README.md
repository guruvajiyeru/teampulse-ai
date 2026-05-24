<div align="center">
<img width="1200" height="475" alt="TeamPulseAI" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# TeamPulseAI

A full-stack TeamPulse AI web application with React/Vite frontend and Express/MongoDB backend.

## Project structure

- `client/` — Vite + React frontend
- `server/` — Express backend with API, Socket.IO, MongoDB support, and optional static frontend serving
- `.env.example` files — environment setup examples for frontend and backend
- `netlify.toml` — frontend deploy config for Netlify
- `render.yaml` — backend deploy config for Render

## Local setup

1. Install root dependencies:
   ```bash
   npm install
   ```
2. Copy server environment example:
   ```bash
   cp server/.env.example server/.env
   ```
3. Update `server/.env` values:
   - `MONGO_URI`
   - `GEMINI_API_KEY`
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (optional)
   - `CLIENT_URL` for local frontend (`http://localhost:5173`)
4. Run locally:
   ```bash
   npm run dev
   ```
5. Open the frontend at:
   - `http://localhost:5173`

## Build for production

- Frontend only:
  ```bash
  npm run build
  ```
- Backend only:
  ```bash
  npm run build:server
  ```
- Full production build:
  ```bash
  npm run build:all
  ```

## Frontend deployment (Netlify / Vercel)

### Netlify

1. Connect your repo to Netlify.
2. Use these settings:
   - Base directory: `client`
   - Build command: `npm install && npm run build`
   - Publish directory: `dist`
3. Add environment variables if you deploy frontend separately:
   - `VITE_API_BASE_URL=https://<your-backend-url>`
   - `VITE_SOCKET_URL=https://<your-backend-url>`
4. Deploy.

### Vercel

1. Create a Vercel project from this repository.
2. Set root directory to `client`.
3. Use build command: `npm install && npm run build`.
4. Set output directory: `dist`.
5. Add `VITE_API_BASE_URL` and `VITE_SOCKET_URL` for your backend URL if needed.

## Backend deployment (Render)

1. Connect your repo to Render.
2. Use `render.yaml` in the repo root for service configuration.
3. Set environment variables in Render dashboard:
   - `NODE_ENV=production`
   - `PORT=3000`
   - `CLIENT_URL=https://<your-frontend-url>`
   - `MONGO_URI`
   - `GEMINI_API_KEY`
   - `SMTP_HOST`
   - `SMTP_PORT`
   - `SMTP_USER`
   - `SMTP_PASS`
   - `SMTP_FROM`
4. Deploy.

## Environment variables

### Backend (`server/.env`)
- `PORT`
- `NODE_ENV`
- `CLIENT_URL`
- `CLIENT_DIST_PATH` (optional if serving frontend from backend)
- `MONGO_URI`
- `GEMINI_API_KEY`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

### Frontend (`client/.env`)
- `VITE_API_BASE_URL`
- `VITE_SOCKET_URL`

## Notes

- The frontend now supports separate deployments via `VITE_API_BASE_URL` and `VITE_SOCKET_URL`.
- The backend now reads `PORT` correctly after loading environment variables.
- The server supports optional static build serving from `CLIENT_DIST_PATH` when using the same host.
