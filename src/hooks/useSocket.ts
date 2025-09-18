// src/hooks/useSocket.ts
"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';

interface UseSocketProps {
    roomId: string;
    userId: string;
    userName: string;
}

interface ParticipantStatus {
    userId: string;
    isMuted: boolean;
    isStreaming: boolean;
    isRaised?: boolean;
    isSpeaking?: boolean;
    isVideoOff?: boolean;
}

export const useSocket = ({ roomId, userId, userName }: UseSocketProps) => {
    const socketRef = useRef<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [participants, setParticipants] = useState<string[]>([]);
    const [participantStatus, setParticipantStatus] = useState<Map<string, ParticipantStatus>>(new Map());

    useEffect(() => {
        // Get socket URL - in production it should be the same origin, in dev use localhost
        const socketUrl = process.env.NODE_ENV === 'production'
            ? `${window.location.protocol}//${window.location.host}`
            : (process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3002');

        console.log('🔌 Connecting to Socket.IO server:', socketUrl);

        // Initialize Socket.IO connection with environment-aware URL
        const socket = io(socketUrl, {
            autoConnect: true,
            transports: ['websocket', 'polling'],
        });

        socketRef.current = socket;

        // Connection events
        socket.on('connect', () => {
            console.log('✅ CLAUDE DEBUG: Connected to Socket.IO server');
            console.log('✅ CLAUDE DEBUG: Socket ID:', socket.id);
            setIsConnected(true);

            // Join the room
            console.log('🚪 CLAUDE DEBUG: Emitting join-room event:', { roomId, userId, userName });
            socket.emit('join-room', {
                roomId,
                userId,
                userName,
            });

            // Send participant status update for joining
            socket.emit('participant-status', {
                userId,
                userName,
                status: 'joined',
            });
        });

        socket.on('disconnect', () => {
            console.log('❌ Disconnected from Socket.IO server');
            setIsConnected(false);
        });

        socket.on('connect_error', (error) => {
            console.error('❌ Socket.IO connection error:', error);
            setIsConnected(false);

            // Show user-friendly message for production deployment issues
            if (error.message.includes('websocket error') || error.message.includes('Transport unknown')) {
                console.log('💡 Tip: Make sure the Socket.IO server is deployed to Render and the NEXT_PUBLIC_SOCKET_URL environment variable is set correctly.');
                console.log('🔗 Current socket URL:', socketUrl);
                console.log('📖 See RENDER_DEPLOYMENT.md for deployment instructions');
            }
        });

        // Room events
        socket.on('room-participants', (participantList: string[]) => {
            console.log('👥 CLAUDE DEBUG: Room participants updated:', participantList);
            console.log('👥 CLAUDE DEBUG: Setting participants state...');
            setParticipants(participantList);
            console.log('👥 CLAUDE DEBUG: Participants state should now be set');
        });

        socket.on('participant-joined', (data: { userId: string; userName: string }) => {
            console.log('➕ Participant joined:', data.userName);
            setParticipants(prev => {
                if (!prev.includes(data.userId)) {
                    return [...prev, data.userId];
                }
                return prev;
            });
        });

        socket.on('participant-left', (data: { userId: string }) => {
            console.log('➖ Participant left:', data.userId);
            setParticipants(prev => prev.filter(id => id !== data.userId));
            setParticipantStatus(prev => {
                const newMap = new Map(prev);
                newMap.delete(data.userId);
                return newMap;
            });
        });

        // Participant status events
        socket.on('participant-status-update', (data: ParticipantStatus) => {
            console.log('📊 Participant status update received:', data);
            setParticipantStatus(prev => {
                const newMap = new Map(prev);
                console.log(`🔄 Updating participant status for ${data.userId}:`, data);
                newMap.set(data.userId, data);
                return newMap;
            });
        });

        socket.on('participant-audio-update', (data: ParticipantStatus) => {
            console.log('🎤 Audio status update received:', data);
            setParticipantStatus(prev => {
                const newMap = new Map(prev);
                const existing = newMap.get(data.userId) || { userId: data.userId, isMuted: false, isStreaming: false };

                // Only update if the status has actually changed
                if (existing.isMuted !== data.isMuted || existing.isStreaming !== data.isStreaming) {
                    console.log(`🔄 Updating audio status for ${data.userId}: muted=${data.isMuted}, streaming=${data.isStreaming}`);
                    newMap.set(data.userId, { ...existing, isMuted: data.isMuted, isStreaming: data.isStreaming });
                    return newMap;
                }
                return prev; // Return previous state if nothing changed
            });
        });

        socket.on('speaking-update', (data: { userId: string; userName: string; isSpeaking: boolean; volume?: number }) => {
            console.log('🗣️ Speaking update:', data);
            setParticipantStatus(prev => {
                const newMap = new Map(prev);
                const existing = newMap.get(data.userId) || { userId: data.userId, isMuted: false, isStreaming: false };

                // Only update if the speaking status has actually changed
                if (existing.isSpeaking !== data.isSpeaking) {
                    newMap.set(data.userId, { ...existing, isSpeaking: data.isSpeaking });
                    return newMap;
                }
                return prev; // Return previous state if nothing changed
            });
        });

        socket.on('participant-hand-update', (data: { userId: string; userName: string; isRaised: boolean }) => {
            console.log('✋ Hand raise update:', data);
            setParticipantStatus(prev => {
                const newMap = new Map(prev);
                const existing = newMap.get(data.userId) || { userId: data.userId, isMuted: false, isStreaming: false };

                // Update the hand raised status
                newMap.set(data.userId, { ...existing, isRaised: data.isRaised });
                return newMap;
            });
        });

        // Video status handler
        socket.on('participant-video-status', (data: { userId: string; userName: string; isVideoOn: boolean }) => {
            console.log('📹 Video status update:', data);
            setParticipantStatus(prev => {
                const newMap = new Map(prev);
                const existing = newMap.get(data.userId) || { userId: data.userId, isMuted: false, isStreaming: false };

                // Update the video status (note: isVideoOff is opposite of isVideoOn)
                newMap.set(data.userId, { ...existing, isVideoOff: !data.isVideoOn });
                return newMap;
            });
        });

        // Chat message handler
        socket.on('chat-message', (data: { userId: string; userName: string; message: string; timestamp: string }) => {
            console.log('💬 Chat message received:', data);
            // This will be handled by the component that uses this hook
        });

        // Cleanup function
        return () => {
            if (socketRef.current) {
                socketRef.current.off('participant-video-status');
                socketRef.current.off('participant-audio-update');
                socketRef.current.off('participant-hand-update');
                socketRef.current.disconnect();
            }
        };
    }, [roomId, userId, userName]);

    // Functions to send data
    const sendChatMessage = useCallback((message: string) => {
        if (socketRef.current) {
            socketRef.current.emit('chat-message', {
                userId,
                userName,
                message,
                timestamp: new Date().toISOString(),
            });
        }
    }, [userId, userName]);

    const updateAudioStatus = useCallback((isMuted: boolean, isStreaming: boolean) => {
        if (socketRef.current) {
            socketRef.current.emit('audio-status', {
                isMuted: isMuted,
                isStreaming: isStreaming,
            });
        }
    }, [userId]);

    const sendSpeakingStatus = useCallback((isSpeaking: boolean, volume?: number) => {
        if (socketRef.current) {
            socketRef.current.emit('speaking-status', {
                isSpeaking,
                volume,
            });
        }
    }, [userId, userName]);

    const toggleHandRaise = useCallback((isRaised: boolean) => {
        if (socketRef.current) {
            console.log(`🤚 Emitting hand-status: ${userName} hand-${isRaised ? 'raised' : 'lowered'}`);
            socketRef.current.emit('hand-status', {
                isRaised,
            });
        } else {
            console.error('❌ Socket not connected, cannot emit hand-status');
        }
    }, [userId, userName]);

    const sendAudioData = useCallback((audioData: ArrayBuffer) => {
        if (socketRef.current) {
            // Convert ArrayBuffer to base64 for transmission
            const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioData)));
            socketRef.current.emit('audio-data', {
                userId,
                audioData: base64Audio,
                timestamp: Date.now(),
            });
        }
    }, [userId]);

    console.log('🔄 CLAUDE DEBUG: useSocket returning participants:', participants);
    
    return {
        isConnected,
        participants,
        participantStatus,
        sendChatMessage,
        sendAudioData,
        updateAudioStatus,
        sendSpeakingStatus,
        toggleHandRaise,
        socketRef,
    };
};
