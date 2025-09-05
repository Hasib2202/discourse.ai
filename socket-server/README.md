# Socket.IO Server Deployment

This directory contains the standalone Socket.IO server for the discourse meeting application.

## Deployment Options

### Option 1: Railway (Recommended)

1. Create account at [railway.app](https://railway.app)
2. Connect your GitHub repository
3. Create new project from this `socket-server` directory
4. Railway will automatically detect the Node.js app and deploy
5. Copy the deployed URL (e.g., `https://your-app.railway.app`)
6. Update the `.env.local` in the main project:
   ```
   NEXT_PUBLIC_SOCKET_URL=https://your-app.railway.app
   ```

### Option 2: Render

1. Create account at [render.com](https://render.com)
2. Create new "Web Service"
3. Connect GitHub and select this repository
4. Set build command: `cd socket-server && npm install`
5. Set start command: `cd socket-server && npm start`
6. Copy the deployed URL
7. Update the environment variable as above

### Option 3: Heroku

1. Install Heroku CLI
2. Create new Heroku app
3. Deploy this directory
4. Update environment variable with Heroku app URL

## Local Development

```bash
cd socket-server
npm install
npm start
```

## Environment Variables

The server automatically uses `process.env.PORT` for deployment platforms.

## CORS Configuration

The server is configured to accept connections from:
- localhost:3000 (development)
- Vercel deployment domains
- All .vercel.app subdomains
