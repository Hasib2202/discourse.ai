# Socket.IO Server for Render Deployment

This directory contains the standalone Socket.IO server for the discourse meeting application.

## Automatic Deployment to Render

### Step 1: Create Render Account

1. Go to [render.com](https://render.com) and create an account
2. Connect your GitHub account

### Step 2: Deploy Socket.IO Server

1. In Render dashboard, click **"New +"** → **"Web Service"**
2. Select **"Build and deploy from a Git repository"**
3. Connect your GitHub repository: `Hasib2202/discourse.ai`
4. Configure the service:
   - **Name**: `discourse-socket-server`
   - **Region**: Choose closest to your users
   - **Branch**: `dev`
   - **Root Directory**: `socket-server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (for testing) or Starter ($7/month for production)

### Step 3: Configure Environment Variables (if needed)

- Render automatically sets `PORT` environment variable
- No additional variables needed for basic setup

### Step 4: Update Frontend Configuration

1. After deployment, copy your Render service URL (e.g., `https://discourse-socket-server.onrender.com`)
2. Update your Vercel environment variables:
   ```
   NEXT_PUBLIC_SOCKET_URL=https://discourse-socket-server.onrender.com
   ```
3. Redeploy your Vercel frontend

## Local Development

```bash
cd socket-server
npm install
npm start
```

## Features

- ✅ **Automatic deploys** when you push to dev branch
- ✅ **Free tier available** for testing
- ✅ **WebSocket support** included
- ✅ **Health check endpoint** at `/health`
- ✅ **CORS configured** for your Vercel domains

## CORS Configuration

The server accepts connections from:

- `localhost:3000` (development)
- Your Vercel deployment domains
- All `.vercel.app` subdomains
- All `.onrender.com` subdomains
