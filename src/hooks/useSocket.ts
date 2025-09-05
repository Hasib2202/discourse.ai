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
}

export const useSocket = ({ roomId, userId, userName }: UseSocketProps) => {
    const socketRef = useRef<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [participants, setParticipants] = useState<string[]>([]);
    const [participantStatus, setParticipantStatus] = useState<Map<string, ParticipantStatus>>(new Map());

    useEffect(() => {
        // Initialize Socket.IO connection to integrated server (same port as Next.js)
        const socket = io('http://localhost:3001', {
            autoConnect: true,
            transports: ['websocket', 'polling'],
        });

        socketRef.current = socket;

        // Connection events
        socket.on('connect', () => {
            console.log('✅ Connected to Socket.IO server');
            setIsConnected(true);

            // Join the room
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
        });

        // Room events
        socket.on('room-participants', (participantList: string[]) => {
            console.log('👥 Room participants updated:', participantList);
            setParticipants(participantList);
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

        socket.on('audio-status-update', (data: ParticipantStatus) => {
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

        // Chat message handler
        socket.on('chat-message', (data: { userId: string; userName: string; message: string; timestamp: string }) => {
            console.log('💬 Chat message received:', data);
            // This will be handled by the component that uses this hook
        });

        // Cleanup function
        return () => {
            if (socketRef.current) {
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
                userId,
                muted: isMuted,
                streaming: isStreaming,
            });
        }
    }, [userId]);

    const sendSpeakingStatus = useCallback((isSpeaking: boolean, volume?: number) => {
        if (socketRef.current) {
            socketRef.current.emit('speaking-status', {
                userId,
                userName,
                isSpeaking,
                volume,
            });
        }
    }, [userId, userName]);

    const toggleHandRaise = useCallback((isRaised: boolean) => {
        if (socketRef.current) {
            socketRef.current.emit('participant-status', {
                userId,
                userName,
                status: isRaised ? 'hand-raised' : 'hand-lowered',
                handRaised: isRaised,
            });
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
