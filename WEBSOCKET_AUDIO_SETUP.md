# WebSocket Audio Server Setup

This guide explains how to set up a WebSocket server for real-time audio streaming in your debate application.

## Quick Setup

### 1. Create Audio Server Directory

```bash
mkdir audio-server
cd audio-server
npm init -y
```

### 2. Install Dependencies

```bash
npm install ws express cors dotenv
npm install -D @types/ws @types/express
```

### 3. Create Server File (server.js)

```javascript
const WebSocket = require("ws");
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;
const HTTP_PORT = process.env.HTTP_PORT || 3001;

// Store room connections
const rooms = new Map();

// Create WebSocket server
const wss = new WebSocket.Server({ port: PORT });

console.log(`🎵 Audio WebSocket server running on ws://localhost:${PORT}`);

wss.on("connection", function connection(ws, req) {
  console.log("📞 New WebSocket connection");

  let currentRoom = null;
  let userId = null;

  ws.on("message", function incoming(data) {
    try {
      // Handle text messages (control)
      if (typeof data === "string") {
        const message = JSON.parse(data);

        if (message.type === "join_room") {
          currentRoom = message.roomId;
          userId = message.userId;

          // Add to room
          if (!rooms.has(currentRoom)) {
            rooms.set(currentRoom, new Set());
          }
          rooms.get(currentRoom).add(ws);

          console.log(`👤 User ${userId} joined room ${currentRoom}`);

          // Broadcast user joined
          broadcastToRoom(
            currentRoom,
            JSON.stringify({
              type: "user_joined",
              userId: userId,
              timestamp: Date.now(),
            }),
            ws
          );
        } else if (message.type === "control") {
          // Broadcast control messages to room
          broadcastToRoom(currentRoom, data, ws);
        } else if (message.type === "status") {
          // Broadcast status messages to room
          broadcastToRoom(currentRoom, data, ws);
        }
      } else {
        // Handle binary audio data
        if (currentRoom) {
          broadcastAudioToRoom(currentRoom, data, ws);
        }
      }
    } catch (error) {
      console.error("❌ Error handling message:", error);
    }
  });

  ws.on("close", function () {
    console.log(`👋 User ${userId} disconnected from room ${currentRoom}`);

    if (currentRoom && rooms.has(currentRoom)) {
      rooms.get(currentRoom).delete(ws);

      // If room is empty, remove it
      if (rooms.get(currentRoom).size === 0) {
        rooms.delete(currentRoom);
      } else {
        // Broadcast user left
        broadcastToRoom(
          currentRoom,
          JSON.stringify({
            type: "user_left",
            userId: userId,
            timestamp: Date.now(),
          }),
          ws
        );
      }
    }
  });

  ws.on("error", function (error) {
    console.error("❌ WebSocket error:", error);
  });
});

// Broadcast text message to all clients in room except sender
function broadcastToRoom(roomId, message, sender) {
  if (!rooms.has(roomId)) return;

  rooms.get(roomId).forEach(function (client) {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Broadcast audio data to all clients in room except sender
function broadcastAudioToRoom(roomId, audioData, sender) {
  if (!rooms.has(roomId)) return;

  rooms.get(roomId).forEach(function (client) {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(audioData);
    }
  });
}

// HTTP endpoints for room management
app.get("/rooms", (req, res) => {
  const roomList = Array.from(rooms.keys()).map((roomId) => ({
    roomId,
    participants: rooms.get(roomId).size,
  }));
  res.json(roomList);
});

app.get("/rooms/:roomId/participants", (req, res) => {
  const { roomId } = req.params;
  const participantCount = rooms.has(roomId) ? rooms.get(roomId).size : 0;
  res.json({ roomId, participants: participantCount });
});

// Start HTTP server for API endpoints
app.listen(HTTP_PORT, () => {
  console.log(`🌐 HTTP API server running on http://localhost:${HTTP_PORT}`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down audio server...");
  wss.clients.forEach(function (client) {
    client.close();
  });
  process.exit(0);
});
```

### 4. Create Package.json Scripts

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```

### 5. Run the Server

```bash
npm start
```

## Integration with Debate App

### Update WebSocket URL

In your React component, update the WebSocket URL:

```typescript
// In WebSocketAudioStreaming.tsx
const wsUrl = `ws://localhost:8080`;

// Send join room message after connection
ws.onopen = () => {
  const joinMessage = {
    type: "join_room",
    roomId: roomId,
    userId: currentUser.id,
    timestamp: Date.now(),
  };
  ws.send(JSON.stringify(joinMessage));
};
```

## Testing

### 1. Start Both Servers

```bash
# Terminal 1: Audio server
cd audio-server
npm start

# Terminal 2: Next.js app
cd discourse-frontend
npm run dev
```

### 2. Test Audio Streaming

1. Open 2 browsers to http://localhost:3001
2. Create a room and start debate
3. Both users should see "Audio Connected"
4. Grant microphone permissions
5. Current speaker can start streaming
6. Other participant should hear the audio

## Features

### ✅ Real-time Audio Streaming

- Low-latency WebSocket communication
- Binary audio data transmission
- Automatic room management

### ✅ Control Messages

- User join/leave notifications
- Mute/unmute status
- Speaking indicators

### ✅ Room Management

- Automatic room creation/cleanup
- Participant tracking
- HTTP API for monitoring

## Performance Tips

### For Better Audio Quality:

```javascript
// In browser audio capture
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 44100,
  },
});
```

### For Lower Latency:

```javascript
// Smaller buffer sizes
const processor = audioContext.createScriptProcessor(512, 1, 1); // Instead of 1024
```

## Troubleshooting

### Common Issues:

1. **CORS errors**: Make sure the server allows your domain
2. **Audio permissions**: Users must grant microphone access
3. **Firewall**: Ensure port 8080 is open
4. **Browser compatibility**: Test in Chrome/Firefox

### Debug Commands:

```bash
# Check if server is running
curl http://localhost:3001/rooms

# Monitor WebSocket connections
# Use browser dev tools → Network → WS tab
```

## Production Deployment

### For production, consider:

1. **SSL/WSS**: Use secure WebSocket connections
2. **Load balancing**: Multiple server instances
3. **Audio processing**: Server-side audio mixing
4. **Monitoring**: Connection health checks
5. **Scaling**: Redis for room state management

This setup provides a solid foundation for real-time audio streaming in your debate application!
