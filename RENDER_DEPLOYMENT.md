# 🚀 Render Deployment Guide

This guide will help you automatically deploy your Socket.IO server to Render.

## 📋 Prerequisites

- GitHub account with your repository
- Render account (free signup at render.com)

## 🔄 Automatic Deployment Steps

### Step 1: Connect Repository to Render

1. **Go to [render.com](https://render.com)** and sign up/login
2. **Click "New +"** in the dashboard
3. **Select "Web Service"**
4. **Choose "Build and deploy from a Git repository"**
5. **Connect your GitHub account** if not already connected
6. **Select repository**: `Hasib2202/discourse.ai`

### Step 2: Configure Service Settings

Fill in these settings:

```
Name: discourse-socket-server
Region: Oregon (US West) or closest to your users
Branch: dev
Root Directory: socket-server
Runtime: Node
Build Command: npm install
Start Command: npm start
Instance Type: Free (for testing) or Starter ($7/month)
```

### Step 3: Environment Variables (Optional)

Render automatically provides:
- `PORT` - Automatically set by Render
- `NODE_ENV=production` - Set in render.yaml

### Step 4: Deploy

1. **Click "Create Web Service"**
2. **Wait for deployment** (usually 2-3 minutes)
3. **Copy the service URL** (e.g., `https://discourse-socket-server.onrender.com`)

### Step 5: Update Frontend Configuration

1. **In Vercel dashboard**, go to your project settings
2. **Add environment variable**:
   ```
   NEXT_PUBLIC_SOCKET_URL = https://discourse-socket-server.onrender.com
   ```
3. **Redeploy your Vercel app**

## ⚡ Auto-Deploy Features

✅ **Automatic deployments** when you push to `dev` branch  
✅ **Health checks** included (`/health` endpoint)  
✅ **Free tier** available for testing  
✅ **WebSocket support** built-in  
✅ **Custom domain** support (paid plans)  
✅ **Zero downtime** deployments  

## 🔧 Configuration Files

This repository includes:
- `render.yaml` - Service configuration
- `socket-server/package.json` - Dependencies
- `socket-server/socket-server.js` - Server code

## 🌐 CORS & Security

The server is configured to accept connections from:
- `localhost:3000` (development)
- All `.vercel.app` domains (your frontend)
- All `.onrender.com` domains (cross-service communication)

## 📊 Monitoring

Access your service logs and metrics in the Render dashboard to monitor:
- Connection counts
- Error rates
- Performance metrics
- Health check status

## 🚨 Troubleshooting

If deployment fails:
1. Check the build logs in Render dashboard
2. Verify `socket-server/package.json` is valid
3. Ensure Node.js version compatibility
4. Check CORS configuration matches your domains

## 💰 Pricing

- **Free Tier**: 750 hours/month, sleeps after 15 min inactivity
- **Starter Plan**: $7/month, always-on, faster builds
- **Pro Plan**: $25/month, more resources, priority support

## 🎉 Success Indicators

Your deployment is successful when:
- ✅ Build completes without errors
- ✅ Service shows "Live" status
- ✅ Health check endpoint responds at `/health`
- ✅ Frontend connects without WebSocket errors
