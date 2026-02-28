MELTDOWN - Deployment Guide

Hey! Thanks for wanting to run this game. Here's how to get it up and running.

NOTE!!

This project has a HARDCODED API PASSWORD in server/routes/rooms.ts:

    const HARDCODED_PASSPHRASE = 'reactor-secret-2026'

BEFORE deploying to production, you MUST:
1. Fork the repository
2. Change this password to something unique

The public container image is built with this password, so you should not use it in production without changing it. 


SETUP STEPS

1. Clone/Fork the repo:
   $ git clone https://github.com/YOUR-USERNAME/meltdown.git
   $ cd meltdown

2. Create your .env file:
   $ cp .env.example .env
   $ # Edit .env and change the DOMAIN to your actual domain
   $ nano .env
   
   Set it to something like:
   DOMAIN=yourdomain.com

3. Update the hardcoded password:
   Edit: server/routes/rooms.ts
   Change line ~33:
   const HARDCODED_PASSPHRASE = 'reactor-secret-2026'
   
   To something like:
   const HARDCODED_PASSPHRASE = 'your-super-secret-password-here'

4. Build & run with Docker Compose:
   $ docker compose up -d
   
   This will:
   - Build the Node.js backend (port 3000)
   - Build the React frontend (Vite SPA)
   - Start Caddy as the reverse proxy
   - Set up SQLite database volume


ACCESSING YOUR GAME
================================================================================

After docker compose up -d completes:

Local Testing:
  - Open http://localhost in your browser
  - Use the hardcoded password when making API calls to /rooms endpoints

Production (with domain):
  - Point your domain DNS to the server's IP address
  - Caddy will auto-generate SSL certificates via Let's Encrypt
  - Access at https://yourdomain.com
  - Game will be live! 


HOW THE DEPLOYMENT WORKS
================================================================================

Services:
  - BACKEND (Node.js): Handles Socket.IO (WebSocket + fallback), game logic, 
                       API endpoints for rooms. Stores data in SQLite.
  - FRONTEND (React + Vite): Single Page App built as static assets, served by nginx
  - CADDY (Reverse Proxy): Routes traffic, handles SSL certificates, 
                           manages WebSocket connections


The docker-compose.yml config:
  - Backend runs on port 3000 (internal only)
  - Frontend runs on nginx (internal only)
  - Caddy listens on ports 80/443 (public facing)
  - SQLite data persists in docker volume 'sqlite_data'
  - Caddy config and SSL certs persist in docker volumes

The Caddyfile routes:
  - /socket.io/* → Backend (WebSocket for real-time game updates)
  - /rooms* → Backend (API for managing rooms)
  - /game* → Backend (Game APIs)
  - Everything else → Frontend (React SPA serves the UI)
