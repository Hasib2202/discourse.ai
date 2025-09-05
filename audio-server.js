// Simple WebSocket Audio Server for Testing
// Save this as: audio-server.js

const { WebSocketServer, WebSocket } = require('ws');

const PORT = 8080;
const rooms = new Map();

const wss = new WebSocketServer({
    port: PORT,
    perMessageDeflate: false, // Disable compression for better performance
    maxPayload: 1024 * 1024, // 1MB max payload
});

console.log(`🎵 Audio WebSocket server running on ws://localhost:${PORT}`);

wss.on('connection', function connection(ws, req) {
    console.log(`📞 New WebSocket connection from ${req.socket.remoteAddress}`);

    let currentRoom = null;
    let userId = null;

    // Setup ping/pong for connection health
    ws.isAlive = true;
    ws.on('pong', function () {
        ws.isAlive = true;
    });

    ws.on('message', function incoming(data) {
        try {
            // Reset alive status on any message
            ws.isAlive = true;

            // Handle text messages (control)
            if (typeof data === 'string') {
                const message = JSON.parse(data);
                console.log(`📨 Received message:`, message.type, message.action || '');

                if (message.type === 'status' && message.action === 'joined') {
                    currentRoom = 'debate-room'; // Simple room for testing
                    userId = message.userId;

                    // Add to room
                    if (!rooms.has(currentRoom)) {
                        rooms.set(currentRoom, new Set());
                    }
                    rooms.get(currentRoom).add(ws);

                    console.log(`👤 User ${userId} joined room ${currentRoom} (${rooms.get(currentRoom).size} total)`);

                    // Send confirmation back
                    ws.send(JSON.stringify({
                        type: 'status',
                        action: 'joined_confirmed',
                        userId: userId,
                        timestamp: Date.now()
                    }));

                } else {
                    // Broadcast other control messages to room
                    broadcastToRoom(currentRoom, data, ws);
                }
            } else {
                // Handle binary audio data
                if (currentRoom && data.byteLength > 0) {
                    broadcastAudioToRoom(currentRoom, data, ws);
                }
            }
        } catch (error) {
            console.error('❌ Error handling message:', error.message);
        }
    });

    ws.on('close', function (code, reason) {
        console.log(`👋 User ${userId} disconnected (Code: ${code}, Reason: ${reason})`);

        if (currentRoom && rooms.has(currentRoom)) {
            rooms.get(currentRoom).delete(ws);

            if (rooms.get(currentRoom).size === 0) {
                rooms.delete(currentRoom);
                console.log(`🏠 Room ${currentRoom} deleted (empty)`);
            } else {
                console.log(`🏠 Room ${currentRoom} now has ${rooms.get(currentRoom).size} users`);
            }
        }
    });

    ws.on('error', function (error) {
        console.error(`❌ WebSocket error for user ${userId}:`, error.message);
    });
});

function broadcastToRoom(roomId, message, sender) {
    if (!rooms.has(roomId)) return;

    let successCount = 0;
    let failCount = 0;

    rooms.get(roomId).forEach(function (client) {
        if (client !== sender && client.readyState === WebSocket.OPEN) {
            try {
                client.send(message);
                successCount++;
            } catch (error) {
                console.error('❌ Error broadcasting message:', error.message);
                failCount++;
            }
        }
    });

    if (failCount > 0) {
        console.log(`📡 Broadcast result: ${successCount} success, ${failCount} failed`);
    }
}

function broadcastAudioToRoom(roomId, audioData, sender) {
    if (!rooms.has(roomId)) return;

    let successCount = 0;
    let failCount = 0;

    rooms.get(roomId).forEach(function (client) {
        if (client !== sender && client.readyState === WebSocket.OPEN) {
            try {
                client.send(audioData);
                successCount++;
            } catch (error) {
                console.error('❌ Error broadcasting audio:', error.message);
                failCount++;
            }
        }
    });

    // Only log if there are failures to avoid spam
    if (failCount > 0) {
        console.log(`🎵 Audio broadcast result: ${successCount} success, ${failCount} failed`);
    }
}

// Ping interval to keep connections alive
const pingInterval = setInterval(function ping() {
    wss.clients.forEach(function each(ws) {
        if (ws.isAlive === false) {
            console.log('💀 Terminating dead connection');
            return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();
    });
}, 30000); // Ping every 30 seconds

process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down audio server...');

    // Clear ping interval
    if (pingInterval) {
        clearInterval(pingInterval);
    }

    // Close all WebSocket connections
    wss.clients.forEach(function (ws) {
        ws.terminate();
    });

    // Close the server
    wss.close(() => {
        console.log('✅ Audio server shutdown complete');
        process.exit(0);
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});
