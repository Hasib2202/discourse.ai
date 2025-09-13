// server.js - Custom Next.js server with integrated Socket.IO
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3002;

// Create Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Store room participants
const roomParticipants = new Map();
const participantInfo = new Map();

// Store WebRTC room participants 
const webrtcRooms = new Map();
const webrtcParticipants = new Map();

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
                console.log(`📡 Broadcasting audio-status-update to room ${participant.roomId}`);
                socket.to(participant.roomId).emit('audio-status-update', {
                    userId,
                    isMuted: muted,
                    isStreaming: streaming
                });
            } else {
                console.log(`❌ No participant found for audio status update, socket: ${socket.id}`);
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

        // Handle hand raise/lower
        socket.on('hand-status', (data) => {
            const { userId, userName, isRaised } = data;
            console.log(`✋ Hand raise update: ${userName} hand-${isRaised ? 'raised' : 'lowered'}`);

            const participant = participantInfo.get(socket.id);
            if (participant) {
                // Broadcast to other participants in the room
                socket.to(participant.roomId).emit('participant-hand-update', {
                    userId,
                    userName,
                    isRaised
                });
            }
        });

        // ===== WebRTC Signaling Handlers =====
        
        // Handle WebRTC room joining
        socket.on('join-webrtc-room', (data) => {
            const { roomId, userId, userName } = data;
            console.log(`🎥 ${userName} joining WebRTC room ${roomId}`);
            
            socket.join(`webrtc_${roomId}`);
            webrtcParticipants.set(socket.id, { userId, userName, roomId });
            
            if (!webrtcRooms.has(roomId)) {
                webrtcRooms.set(roomId, new Set());
            }
            webrtcRooms.get(roomId).add(userId);
            
            console.log(`🎥 WebRTC Room ${roomId} now has ${webrtcRooms.get(roomId).size} participants`);
            
            // Notify existing users about new participant
            socket.to(`webrtc_${roomId}`).emit('user-joined', { userId, userName });
            
            // Get existing participants for the new user
            const existingParticipants = Array.from(webrtcRooms.get(roomId) || [])
                .filter(id => id !== userId);
            
            existingParticipants.forEach(existingUserId => {
                socket.emit('user-joined', { userId: existingUserId, userName: `User ${existingUserId}` });
            });
        });

        // Handle WebRTC offer
        socket.on('webrtc-offer', (data) => {
            const { roomId, toUserId, offer } = data;
            const participant = participantInfo.get(socket.id);
            
            if (participant) {
                console.log(`📞 WebRTC offer from ${participant.userId} to ${toUserId}`);
                
                // Find target socket by userId and roomId
                const targetSocket = Array.from(io.sockets.sockets.values())
                    .find(s => {
                        const targetParticipant = participantInfo.get(s.id);
                        return targetParticipant && 
                               targetParticipant.userId === toUserId && 
                               targetParticipant.roomId === roomId;
                    });
                
                if (targetSocket) {
                    console.log(`✅ Sending offer to specific user ${toUserId}`);
                    targetSocket.emit('webrtc-offer', {
                        offer,
                        fromUserId: participant.userId
                    });
                } else {
                    console.warn(`⚠️ Could not find target socket for user ${toUserId} in room ${roomId}`);
                }
            } else {
                console.log(`❌ No participant found for socket ${socket.id}`);
            }
        });

        // Handle WebRTC answer
        socket.on('webrtc-answer', (data) => {
            const { roomId, toUserId, answer } = data;
            const participant = participantInfo.get(socket.id);
            
            if (participant) {
                console.log(`📞 WebRTC answer from ${participant.userId} to ${toUserId}`);
                
                // Find target socket by userId and roomId
                const targetSocket = Array.from(io.sockets.sockets.values())
                    .find(s => {
                        const targetParticipant = participantInfo.get(s.id);
                        return targetParticipant && 
                               targetParticipant.userId === toUserId && 
                               targetParticipant.roomId === roomId;
                    });
                
                if (targetSocket) {
                    console.log(`✅ Sending answer to specific user ${toUserId}`);
                    targetSocket.emit('webrtc-answer', {
                        answer,
                        fromUserId: participant.userId
                    });
                } else {
                    console.warn(`⚠️ Could not find target socket for user ${toUserId} in room ${roomId}`);
                }
            }
        });

        // Handle ICE candidates
        socket.on('webrtc-ice-candidate', (data) => {
            const { roomId, toUserId, candidate } = data;
            const participant = participantInfo.get(socket.id);
            
            if (participant) {
                console.log(`🧊 ICE candidate from ${participant.userId} to ${toUserId}`);
                
                // Find target socket by userId and roomId
                const targetSocket = Array.from(io.sockets.sockets.values())
                    .find(s => {
                        const targetParticipant = participantInfo.get(s.id);
                        return targetParticipant && 
                               targetParticipant.userId === toUserId && 
                               targetParticipant.roomId === roomId;
                    });
                
                if (targetSocket) {
                    console.log(`✅ Sending ICE candidate to specific user ${toUserId}`);
                    targetSocket.emit('webrtc-ice-candidate', {
                        candidate,
                        fromUserId: participant.userId
                    });
                } else {
                    console.warn(`⚠️ Could not find target socket for user ${toUserId} in room ${roomId}`);
                }
            }
        });

        // Handle participant mute toggle
        socket.on('participant-mute-toggle', (data) => {
            const { roomId, userId, isMuted } = data;
            console.log(`🔇 ${userId} ${isMuted ? 'muted' : 'unmuted'}`);
            
            socket.to(`webrtc_${roomId}`).emit('participant-muted', { userId, isMuted });
        });

        // Handle participant video toggle
        socket.on('participant-video-toggle', (data) => {
            const { roomId, userId, isVideoOff } = data;
            console.log(`📹 ${userId} video ${isVideoOff ? 'off' : 'on'}`);
            
            socket.to(`webrtc_${roomId}`).emit('participant-video-toggle', { userId, isVideoOff });
        });

        // Handle leaving WebRTC room
        socket.on('leave-webrtc-room', (data) => {
            const { roomId, userId } = data;
            console.log(`🎥 ${userId} leaving WebRTC room ${roomId}`);
            
            socket.leave(`webrtc_${roomId}`);
            
            const webrtcUsers = webrtcRooms.get(roomId);
            if (webrtcUsers) {
                webrtcUsers.delete(userId);
                if (webrtcUsers.size === 0) {
                    webrtcRooms.delete(roomId);
                    console.log(`🎥 Removed empty WebRTC room ${roomId}`);
                } else {
                    console.log(`🎥 WebRTC Room ${roomId} now has ${webrtcUsers.size} participants`);
                }
            }
            
            // Notify other participants
            socket.to(`webrtc_${roomId}`).emit('user-left', { userId });
        });

        // Handle screen sharing events
        socket.on('screen-share-start', (data) => {
            const { roomId, userId } = data;
            console.log(`🖥️ ${userId} started screen sharing in room ${roomId}`);
            socket.to(`webrtc_${roomId}`).emit('screen-share-started', { userId });
        });

        socket.on('screen-share-stop', (data) => {
            const { roomId, userId } = data;
            console.log(`🖥️ ${userId} stopped screen sharing in room ${roomId}`);
            socket.to(`webrtc_${roomId}`).emit('screen-share-stopped', { userId });
        });

        // ===== Audio WebRTC Signaling Handlers (separate from video) =====
        
        // Handle Audio WebRTC offer
        socket.on('audio-webrtc-offer', (data) => {
            const { roomId, toUserId, offer } = data;
            const participant = participantInfo.get(socket.id);
            
            if (participant) {
                console.log(`🎤 Audio WebRTC offer from ${participant.userId} to ${toUserId}`);
                
                // Find target socket by userId and roomId
                const targetSocket = Array.from(io.sockets.sockets.values())
                    .find(s => {
                        const targetParticipant = participantInfo.get(s.id);
                        return targetParticipant && 
                               targetParticipant.userId === toUserId && 
                               targetParticipant.roomId === roomId;
                    });
                
                if (targetSocket) {
                    console.log(`✅ Sending audio offer to specific user ${toUserId}`);
                    targetSocket.emit('audio-webrtc-offer', {
                        offer,
                        fromUserId: participant.userId
                    });
                } else {
                    console.warn(`⚠️ Could not find target socket for audio offer to user ${toUserId} in room ${roomId}`);
                }
            } else {
                console.log(`❌ No participant found for audio offer from socket ${socket.id}`);
            }
        });

        // Handle Audio WebRTC answer
        socket.on('audio-webrtc-answer', (data) => {
            const { roomId, toUserId, answer } = data;
            const participant = participantInfo.get(socket.id);
            
            if (participant) {
                console.log(`🎤 Audio WebRTC answer from ${participant.userId} to ${toUserId}`);
                
                // Find target socket by userId and roomId
                const targetSocket = Array.from(io.sockets.sockets.values())
                    .find(s => {
                        const targetParticipant = participantInfo.get(s.id);
                        return targetParticipant && 
                               targetParticipant.userId === toUserId && 
                               targetParticipant.roomId === roomId;
                    });
                
                if (targetSocket) {
                    console.log(`✅ Sending audio answer to specific user ${toUserId}`);
                    targetSocket.emit('audio-webrtc-answer', {
                        answer,
                        fromUserId: participant.userId
                    });
                } else {
                    console.warn(`⚠️ Could not find target socket for audio answer to user ${toUserId} in room ${roomId}`);
                }
            }
        });

        // Handle Audio ICE candidates
        socket.on('audio-webrtc-ice-candidate', (data) => {
            const { roomId, toUserId, candidate } = data;
            const participant = participantInfo.get(socket.id);
            
            if (participant) {
                console.log(`🧊 Audio ICE candidate from ${participant.userId} to ${toUserId}`);
                
                // Find target socket by userId and roomId
                const targetSocket = Array.from(io.sockets.sockets.values())
                    .find(s => {
                        const targetParticipant = participantInfo.get(s.id);
                        return targetParticipant && 
                               targetParticipant.userId === toUserId && 
                               targetParticipant.roomId === roomId;
                    });
                
                if (targetSocket) {
                    console.log(`✅ Sending audio ICE candidate to specific user ${toUserId}`);
                    targetSocket.emit('audio-webrtc-ice-candidate', {
                        candidate,
                        fromUserId: participant.userId
                    });
                } else {
                    console.warn(`⚠️ Could not find target socket for audio ICE candidate to user ${toUserId} in room ${roomId}`);
                }
            }
        });

        // Handle video call start
        socket.on('video-call-start', (data) => {
            const { roomId, userId, userName } = data;
            console.log(`🎥 ${userName} started video call in room ${roomId}`);
            
            // Notify OTHER participants that this user joined the video call
            // Don't include the sender (they already know they started it)
            socket.to(roomId).emit('video-call-user-joined', { userId, userName });
            console.log(`📡 Notified other participants in room ${roomId} that ${userName} joined video call`);
        });

        // Handle video call stop
        socket.on('video-call-stop', (data) => {
            const { roomId, userId } = data;
            console.log(`🎥 ${userId} stopped video call in room ${roomId}`);
            
            // Notify other participants that someone left video call
            socket.to(roomId).emit('video-call-user-left', { userId });
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
            
            // Cleanup WebRTC room participation
            const webrtcParticipant = webrtcParticipants.get(socket.id);
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
            
            // Handle WebRTC room cleanup
            if (webrtcParticipant) {
                const { roomId, userId } = webrtcParticipant;
                console.log(`🎥 WebRTC participant ${userId} disconnected from room ${roomId}`);
                
                // Remove from WebRTC room participants
                const webrtcUsers = webrtcRooms.get(roomId);
                if (webrtcUsers) {
                    webrtcUsers.delete(userId);
                    if (webrtcUsers.size === 0) {
                        webrtcRooms.delete(roomId);
                        console.log(`🎥 Removed empty WebRTC room ${roomId}`);
                    } else {
                        console.log(`🎥 WebRTC Room ${roomId} now has ${webrtcUsers.size} participants`);
                    }
                }
                
                webrtcParticipants.delete(socket.id);
                socket.to(`webrtc_${roomId}`).emit('user-left', { userId });
            }
        });
    });

    // Start the server
    httpServer.listen(port, (err) => {
        if (err) throw err;
        console.log(`🚀 Next.js + Socket.IO server ready on http://${hostname}:${port}`);
    });
});
