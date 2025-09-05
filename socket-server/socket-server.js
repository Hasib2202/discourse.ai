// socket-server.js - Standalone Socket.IO server for production deployment
import { createServer } from 'http';
import { Server } from 'socket.io';

const port = process.env.PORT || 3001;

// Create HTTP server
const httpServer = createServer();

// Store room participants
const roomParticipants = new Map();
const participantInfo = new Map();

// Create Socket.IO server with CORS configuration
const io = new Server(httpServer, {
    cors: {
        origin: [
            "http://localhost:3000", 
            "https://discourse-frontend-git-dev-hasib2202s-projects.vercel.app",
            "https://discourse-frontend-2qeli4eai-hasib2202s-projects.vercel.app",
            /\.vercel\.app$/
        ],
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

console.log('🚀 Socket.IO server starting...');

io.on('connection', (socket) => {
    console.log('🔗 Client connected:', socket.id);

    // Join room
    socket.on('join-room', ({ roomId, userId, userName }) => {
        console.log(`👤 ${userName} (${userId}) joining room ${roomId}`);
        
        socket.join(roomId);
        socket.userId = userId;
        socket.userName = userName;
        socket.roomId = roomId;

        // Initialize room if it doesn't exist
        if (!roomParticipants.has(roomId)) {
            roomParticipants.set(roomId, new Set());
        }

        // Add participant to room
        const roomUsers = roomParticipants.get(roomId);
        roomUsers.add(userId);

        // Store participant info
        participantInfo.set(userId, {
            userName,
            roomId,
            socketId: socket.id,
            isMuted: true,
            isStreaming: false,
            isRaised: false,
            isSpeaking: false
        });

        console.log(`📊 Room ${roomId} now has ${roomUsers.size} participants`);

        // Send updated participant list to all room members
        io.to(roomId).emit('participants-updated', Array.from(roomUsers));

        // Send participant status to all room members
        io.to(roomId).emit('participant-status', {
            userId,
            userName,
            status: 'joined'
        });

        console.log(`📊 Participant status: ${userName} joined`);
    });

    // Handle audio status updates
    socket.on('audio-status', ({ isMuted, isStreaming, volume }) => {
        const userInfo = participantInfo.get(socket.userId);
        if (userInfo) {
            userInfo.isMuted = isMuted;
            userInfo.isStreaming = isStreaming;
            
            console.log(`🎤 ${socket.userId} audio status: muted=${isMuted}, streaming=${isStreaming}`);
            
            // Broadcast to other participants in the room
            socket.to(socket.roomId).emit('participant-audio-update', {
                userId: socket.userId,
                userName: socket.userName,
                isMuted,
                isStreaming,
                volume
            });
        }
    });

    // Handle speaking status
    socket.on('speaking-status', ({ isSpeaking, volume }) => {
        const userInfo = participantInfo.get(socket.userId);
        if (userInfo) {
            userInfo.isSpeaking = isSpeaking;
            
            console.log(`🗣️ Speaking status: ${socket.userName} is ${isSpeaking ? 'speaking' : 'not speaking'} (volume: ${volume || 0})`);
            
            // Broadcast to all participants in the room (including sender for consistency)
            io.to(socket.roomId).emit('speaking-update', {
                userId: socket.userId,
                userName: socket.userName,
                isSpeaking,
                volume
            });
        }
    });

    // Handle hand raise/lower
    socket.on('hand-status', ({ isRaised }) => {
        const userInfo = participantInfo.get(socket.userId);
        if (userInfo) {
            userInfo.isRaised = isRaised;
            
            console.log(`📊 Participant status: ${socket.userName} hand-${isRaised ? 'raised' : 'lowered'}`);
            
            // Broadcast to other participants in the room
            socket.to(socket.roomId).emit('participant-hand-update', {
                userId: socket.userId,
                userName: socket.userName,
                isRaised
            });
        }
    });

    // Handle chat messages
    socket.on('chat-message', ({ message }) => {
        console.log(`💬 Chat message from ${socket.userName}: ${message}`);
        
        // Broadcast to all participants in the room
        io.to(socket.roomId).emit('chat-message', {
            id: `${socket.userId}-${Date.now()}`,
            userId: socket.userId,
            userName: socket.userName,
            message,
            timestamp: new Date().toISOString()
        });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('❌ Client disconnected:', socket.id);
        
        if (socket.userId && socket.roomId) {
            console.log(`📊 User ${socket.userId} left room ${socket.roomId}`);
            
            // Remove from room participants
            const roomUsers = roomParticipants.get(socket.roomId);
            if (roomUsers) {
                roomUsers.delete(socket.userId);
                console.log(`📊 Room ${socket.roomId} now has ${roomUsers.size} participants`);
                
                // If room is empty, remove it
                if (roomUsers.size === 0) {
                    roomParticipants.delete(socket.roomId);
                    console.log(`🗑️ Removed empty room ${socket.roomId}`);
                } else {
                    // Send updated participant list to remaining members
                    io.to(socket.roomId).emit('participants-updated', Array.from(roomUsers));
                }
            }
            
            // Remove participant info
            participantInfo.delete(socket.userId);
            
            // Notify other participants
            socket.to(socket.roomId).emit('participant-status', {
                userId: socket.userId,
                userName: socket.userName,
                status: 'left'
            });
        }
    });
});

// Health check endpoint
httpServer.on('request', (req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            status: 'ok', 
            timestamp: new Date().toISOString(),
            connections: io.engine.clientsCount,
            rooms: roomParticipants.size
        }));
    } else {
        res.writeHead(404);
        res.end('Socket.IO Server Running');
    }
});

httpServer.listen(port, () => {
    console.log(`🚀 Socket.IO server running on port ${port}`);
    console.log(`📊 Health check available at http://localhost:${port}/health`);
});
