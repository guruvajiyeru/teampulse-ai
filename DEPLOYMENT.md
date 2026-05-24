# TeamPulse AI Deployment Guide

This guide explains how to deploy the TeamPulse AI project with a separate frontend and backend.

## 1. Confirm local build success

Run from the repository root:

```bash
npm install
npm run build:all
```

If build succeeds, the frontend is in `client/dist` and the backend bundle is in `server/dist/server.cjs`.

## 2. Backend deployment (Render)

### Recommended backend platform: Render

1. Create a Render account and link this repository.
2. Add a Web Service using the `render.yaml` file in the repo root.
3. Set environment variables in Render:
   - `NODE_ENV=production`
   - `PORT=3000`
   - `CLIENT_URL=https://<your-frontend-url>`
   - `MONGO_URI=your_mongodb_connection_string`
   - `GEMINI_API_KEY=your_gemini_api_key`
   - `SMTP_HOST=your_smtp_host`
   - `SMTP_PORT=587`
   - `SMTP_USER=your_smtp_user`
   - `SMTP_PASS=your_smtp_password`
   - `SMTP_FROM=no-reply@teampulse.ai`
   - `CLIENT_DIST_PATH=../client/dist` (optional if you want the backend to serve the built frontend)

4. Deploy. Render will run:
   - `cd server && npm install && npm run build`
   - `cd server && npm start`

### Backend service settings

- `Build Command`: `cd server && npm install && npm run build`
- `Start Command`: `cd server && npm start`
- `Environment`: Node
- `Region`: choose closest region

## 3. Frontend deployment (Netlify or Vercel)

### Option A: Netlify

1. Connect the repository to Netlify.
2. Set the deploy settings:
   - Base directory: `client`
   - Build command: `npm install && npm run build`
   - Publish directory: `dist`
3. Add required environment variables if frontend uses a separate backend URL:
   - `VITE_API_BASE_URL=https://<your-backend-url>`
   - `VITE_SOCKET_URL=https://<your-backend-url>`
4. Deploy.

### Option B: Vercel

1. Create a new Vercel project from this repository.
2. Set the root directory to `client`.
3. Use build command: `npm install && npm run build`
4. Set output directory: `dist`
5. Add environment variables:
   - `VITE_API_BASE_URL=https://<your-backend-url>`
   - `VITE_SOCKET_URL=https://<your-backend-url>`

## 4. Environment variables summary

### Backend variables (`server/.env` or Render environment)

- `PORT`
- `NODE_ENV`
- `CLIENT_URL`
- `CLIENT_DIST_PATH`
- `MONGO_URI`
- `GEMINI_API_KEY`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

### Frontend variables (`client/.env`)

- `VITE_API_BASE_URL`
- `VITE_SOCKET_URL`

If both frontend and backend live on the same domain, leave these blank.

## 5. Local testing after deploy config

1. Start frontend locally:
   ```bash
   npm run dev
   ```
2. Start backend locally:
   ```bash
   cd server
   npx tsx server.ts
   ```

## 6. Notes

- The backend serve path is now configurable through `CLIENT_DIST_PATH`, so a single Render service can also host the frontend.
- The frontend now supports separate API and socket URLs configured with `VITE_API_BASE_URL` and `VITE_SOCKET_URL`.
- Keep `.env` files out of version control and use `.env.example` as a template.

## 7. Netlify CLI deployment helper

If you want to deploy the frontend from this repository directly, use the included script:

```powershell
./deploy-netlify.ps1
```

Or use npm script:

```bash
npm run deploy:netlify
```

Before running the script, authenticate with Netlify CLI:

```bash
npx netlify login
```

If you have not yet initialized the site, run:

```bash
npx netlify init
```

Then deploy:

```bash
npm run deploy:netlify
```
