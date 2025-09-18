// socket-server.js - Standalone Socket.IO server for production deployment
import { createServer } from 'http';
import { Server } from 'socket.io';

const port = process.env.PORT || 3001;

// Create HTTP server
const httpServer = createServer();

// Store room participants
const roomParticipants = new Map();
const participantInfo = new Map();

// Create Socket.IO server with CORS configuration for Render deployment
const io = new Server(httpServer, {
    cors: {
        origin: [
            "http://localhost:3000",
            "https://discourse-frontend.vercel.app",
            "https://discourse-frontend-git-devui2-hasib2202s-projects.vercel.app",
            "https://discourse-frontend-git-dev-hasib2202s-projects.vercel.app",
            "https://discourse-frontend-2qeli4eai-hasib2202s-projects.vercel.app",
            /\.vercel\.app$/,
            /\.onrender\.com$/
        ],
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

console.log('🚀 Socket.IO server starting...');

io.on('connection', (socket) => {
    console.log('🔗 Client connected:', socket.id);

    // Handle room joining
    socket.on('join-room', (data) => {
        const { roomId, userId, userName } = data;
        console.log(`👤 ${userName} (${userId}) joining room ${roomId}`);

        socket.join(roomId);
        participantInfo.set(socket.id, { userId, userName, roomId });

        if (!roomParticipants.has(roomId)) {
            roomParticipants.set(roomId, new Set());
        }
        roomParticipants.get(roomId).add(userId);

        console.log(`📊 Room ${roomId} now has ${roomParticipants.get(roomId).size} participants`);

        // Get current participant list
        const currentParticipants = Array.from(roomParticipants.get(roomId) || []);

        // Send to the joining user
        socket.emit('room-participants', currentParticipants);

        // Notify others in the room about new participant
        socket.to(roomId).emit('participant-joined', { userId, userName });

        // Broadcast updated participant list to everyone in the room
        io.to(roomId).emit('room-participants', currentParticipants);
    });

    // Handle participant status
    socket.on('participant-status', (data) => {
        const { userId, userName, status, muted, handRaised } = data;
        console.log(`📊 Participant status: ${userName} ${status}`);

        const participant = participantInfo.get(socket.id);
        if (participant) {
            // Broadcast to all participants in the room (including sender)
            io.to(participant.roomId).emit('participant-status-update', {
                userId,
                userName,
                status,
                isMuted: muted,
                isRaised: handRaised
            });
        }
    });

    // Handle audio status
    socket.on('audio-status', (data) => {
        const { isMuted, isStreaming } = data;
        const participant = participantInfo.get(socket.id);

        if (participant) {
            const { userId, userName } = participant;
            console.log(`🎤 ${userId} audio status: muted=${isMuted}, streaming=${isStreaming}`);
            console.log(`📡 Broadcasting participant-audio-update to room ${participant.roomId}`);

            // Broadcast to everyone in the room including the sender
            io.to(participant.roomId).emit('participant-audio-update', {
                userId,
                userName,
                isMuted,
                isStreaming
            });
        } else {
            console.log(`❌ No participant found for audio status update, socket: ${socket.id}`);
        }
    });

    // Handle speaking status
    socket.on('speaking-status', (data) => {
        const { isSpeaking, volume } = data;
        const participant = participantInfo.get(socket.id);

        if (participant) {
            const { userId, userName } = participant;

            if (isSpeaking) {
                console.log(`🗣️ Speaking status: ${userName} is speaking (volume: ${volume})`);
            }

            socket.to(participant.roomId).emit('speaking-update', {
                userId, userName, isSpeaking, volume
            });
        }
    });

    // Handle chat messages
    socket.on('chat-message', (data) => {
        const { userId, userName, message, timestamp } = data;
        console.log(`💬 Chat message from ${userName}: ${message}`);

        const participant = participantInfo.get(socket.id);
        if (participant) {
            io.to(participant.roomId).emit('chat-message', {
                userId, userName, message, timestamp
            });
        }
    });

    // Handle hand raise/lower
    socket.on('hand-status', (data) => {
        const { isRaised } = data;
        const participant = participantInfo.get(socket.id);

        if (participant) {
            const { userId, userName } = participant;
            console.log(`✋ Hand raise update: ${userName} hand-${isRaised ? 'raised' : 'lowered'}`);

            // Broadcast to everyone in the room including the sender
            io.to(participant.roomId).emit('participant-hand-update', {
                userId,
                userName,
                isRaised
            });
        }
    });


    // ===== Audio WebRTC Signaling Handlers (separate from video) =====

    // Handle Audio WebRTC offer
    socket.on('audio-webrtc-offer', ({ roomId, toUserId, offer }) => {
        console.log(`🎤 Audio WebRTC offer from ${socket.userId} to ${toUserId}`);

        // Find target socket by userId and roomId
        const targetSocket = Array.from(io.sockets.sockets.values())
            .find(s => s.userId === toUserId && s.roomId === roomId);

        if (targetSocket) {
            console.log(`✅ Sending audio offer to specific user ${toUserId}`);
            targetSocket.emit('audio-webrtc-offer', {
                offer,
                fromUserId: socket.userId
            });
        } else {
            console.warn(`⚠️ Could not find target socket for audio offer to user ${toUserId} in room ${roomId}`);
        }
    });

    // Handle Audio WebRTC answer
    socket.on('audio-webrtc-answer', ({ roomId, toUserId, answer }) => {
        console.log(`🎤 Audio WebRTC answer from ${socket.userId} to ${toUserId}`);

        // Find target socket by userId and roomId
        const targetSocket = Array.from(io.sockets.sockets.values())
            .find(s => s.userId === toUserId && s.roomId === roomId);

        if (targetSocket) {
            console.log(`✅ Sending audio answer to specific user ${toUserId}`);
            targetSocket.emit('audio-webrtc-answer', {
                answer,
                fromUserId: socket.userId
            });
        } else {
            console.warn(`⚠️ Could not find target socket for audio answer to user ${toUserId} in room ${roomId}`);
        }
    });

    // Handle Audio ICE candidates
    socket.on('audio-webrtc-ice-candidate', ({ roomId, toUserId, candidate }) => {
        console.log(`🧊 Audio ICE candidate from ${socket.userId} to ${toUserId}`);

        // Find target socket by userId and roomId
        const targetSocket = Array.from(io.sockets.sockets.values())
            .find(s => s.userId === toUserId && s.roomId === roomId);

        if (targetSocket) {
            console.log(`✅ Sending audio ICE candidate to specific user ${toUserId}`);
            targetSocket.emit('audio-webrtc-ice-candidate', {
                candidate,
                fromUserId: socket.userId
            });
        } else {
            console.warn(`⚠️ Could not find target socket for audio ICE candidate to user ${toUserId} in room ${roomId}`);
        }
    });

    // Handle host ending meeting for everyone
    socket.on('host-end-meeting', ({ roomId }) => {
        console.log(`🏁 Host ending meeting in room ${roomId} for all participants`);

        // Notify all other participants in the room that the meeting has ended
        socket.to(roomId).emit('meeting-ended-by-host');
        console.log(`📡 Sent meeting-ended-by-host to all participants in room ${roomId}`);
    });

    // ===== WebRTC Video Call Signaling Events =====
    
    // Handle video call start
    socket.on('video-call-start', ({ roomId, userId, userName }) => {
        console.log(`🎥 ${userName} started video call in room ${roomId}`);
        
        // Notify all other participants in the room that this user joined the video call
        socket.to(roomId).emit('video-call-user-joined', {
            userId,
            userName
        });
    });

    // Handle video call stop  
    socket.on('video-call-stop', ({ roomId, userId }) => {
        console.log(`🛑 ${socket.userName} stopped video call in room ${roomId}`);
        
        // Notify all other participants in the room that this user left the video call
        socket.to(roomId).emit('video-call-user-left', {
            userId
        });
    });

    // Handle WebRTC offer
    socket.on('webrtc-offer', ({ roomId, toUserId, offer }) => {
        console.log(`📞 Relaying WebRTC offer from ${socket.userId} to ${toUserId} in room ${roomId}`);
        
        // Forward the offer to the specific user
        const targetSocket = Array.from(io.sockets.sockets.values())
            .find(s => s.userId === toUserId && s.roomId === roomId);
            
        if (targetSocket) {
            targetSocket.emit('webrtc-offer', {
                offer,
                fromUserId: socket.userId
            });
            console.log(`✅ Successfully relayed offer to ${toUserId}`);
        } else {
            console.warn(`⚠️ Could not find target socket for user ${toUserId}`);
        }
    });

    // Handle WebRTC answer
    socket.on('webrtc-answer', ({ roomId, toUserId, answer }) => {
        console.log(`📞 Relaying WebRTC answer from ${socket.userId} to ${toUserId} in room ${roomId}`);
        
        // Forward the answer to the specific user
        const targetSocket = Array.from(io.sockets.sockets.values())
            .find(s => s.userId === toUserId && s.roomId === roomId);
            
        if (targetSocket) {
            targetSocket.emit('webrtc-answer', {
                answer,
                fromUserId: socket.userId
            });
            console.log(`✅ Successfully relayed answer to ${toUserId}`);
        } else {
            console.warn(`⚠️ Could not find target socket for user ${toUserId}`);
        }
    });

    // Handle WebRTC ICE candidates
    socket.on('webrtc-ice-candidate', ({ roomId, toUserId, candidate }) => {
        console.log(`🧊 Relaying ICE candidate from ${socket.userId} to ${toUserId} in room ${roomId}`);
        
        // Forward the ICE candidate to the specific user  
        const targetSocket = Array.from(io.sockets.sockets.values())
            .find(s => s.userId === toUserId && s.roomId === roomId);
            
        if (targetSocket) {
            targetSocket.emit('webrtc-ice-candidate', {
                candidate,
                fromUserId: socket.userId
            });
            console.log(`✅ Successfully relayed ICE candidate to ${toUserId}`);
        } else {
            console.warn(`⚠️ Could not find target socket for user ${toUserId}`);
        }
    });

    // Handle participant video toggle (optional - for UI updates)
    socket.on('participant-video-toggle', ({ roomId, userId, isVideoOn }) => {
        console.log(`📹 ${socket.userName} ${isVideoOn ? 'turned on' : 'turned off'} video in room ${roomId}`);
        
        // Broadcast video status to other participants  
        socket.to(roomId).emit('participant-video-status', {
            userId,
            userName: socket.userName,
            isVideoOn
        });
    });

    // Handle debug logs from client
    socket.on('debug-log', (data) => {
        console.log('🐛 CLIENT DEBUG:', data.message, data);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('❌ Client disconnected:', socket.id);

        // Cleanup regular room participation
        const participant = participantInfo.get(socket.id);

        if (participant) {
            const { roomId, userId } = participant;

            // Remove from room participants
            const roomUsers = roomParticipants.get(roomId);
            if (roomUsers) {
                roomUsers.delete(userId);
                console.log(`📊 User ${userId} left room ${roomId}`);

                if (roomUsers.size === 0) {
                    roomParticipants.delete(roomId);
                    console.log(`🗑️ Removed empty room ${roomId}`);
                } else {
                    console.log(`📊 Room ${roomId} now has ${roomUsers.size} participants`);
                    // Broadcast updated participant list
                    const currentParticipants = Array.from(roomUsers);
                    io.to(roomId).emit('room-participants', currentParticipants);
                }
            }

            participantInfo.delete(socket.id);
            socket.to(roomId).emit('participant-left', { userId });
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
