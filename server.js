// server.js - Custom Next.js server with integrated Socket.IO
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3001;

// Create Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Store room participants
const roomParticipants = new Map();
const participantInfo = new Map();

app.prepare().then(() => {
    // Create HTTP server
    const httpServer = createServer(async (req, res) => {
        try {
            const parsedUrl = parse(req.url, true);
            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error('Error occurred handling', req.url, err);
            res.statusCode = 500;
            res.end('internal server error');
        }
    });

    // Initialize Socket.IO
    const io = new Server(httpServer, {
        cors: {
            origin: ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000"],
            methods: ["GET", "POST"]
        }
    });

    // Socket.IO connection handling
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
            const { userId, muted, streaming } = data;
            console.log(`🎤 ${userId} audio status: muted=${muted}, streaming=${streaming}`);

            const participant = participantInfo.get(socket.id);
            if (participant) {
                socket.to(participant.roomId).emit('audio-status-update', {
                    userId,
                    isMuted: muted,
                    isStreaming: streaming
                });
            }
        });

        // Handle speaking status
        socket.on('speaking-status', (data) => {
            const { userId, userName, isSpeaking, volume } = data;

            if (isSpeaking) {
                console.log(`🗣️ Speaking status: ${userName} is speaking (volume: ${volume})`);
            }

            const participant = participantInfo.get(socket.id);
            if (participant) {
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

        // Handle disconnect
        socket.on('disconnect', () => {
            console.log('❌ Client disconnected:', socket.id);

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

    // Start the server
    httpServer.listen(port, (err) => {
        if (err) throw err;
        console.log(`🚀 Next.js + Socket.IO server ready on http://${hostname}:${port}`);
    });
});
