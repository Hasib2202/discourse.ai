// hooks/useWebRTC.ts
"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

export interface Participant {
  userId: string;
  userName: string;
  stream?: MediaStream;
  isMuted: boolean;
  isVideoOff: boolean;
  isHandRaised: boolean;
  isSpeaking: boolean;
}

interface UseWebRTCProps {
  roomId: string;
  userId: string;
  userName: string;
}

export const useWebRTC = ({ roomId, userId, userName }: UseWebRTCProps) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);

  // WebRTC Configuration
  const pcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };

  // Initialize Socket.IO connection
  const initializeSocket = useCallback(() => {
    if (!socketRef.current) {
      socketRef.current = io('http://localhost:3001', {
        transports: ['websocket']
      });

      const socket = socketRef.current;

      // Join room
      socket.emit('join-webrtc-room', { roomId, userId, userName });

      // Handle new user joined
      socket.on('user-joined', async (data: { userId: string; userName: string }) => {
        console.log('User joined:', data);
        if (data.userId !== userId && localStreamRef.current) {
          await createPeerConnection(data.userId, true);
        }
      });

      // Handle WebRTC signaling
      socket.on('webrtc-offer', async (data: { offer: RTCSessionDescriptionInit; fromUserId: string }) => {
        console.log('Received offer from:', data.fromUserId);
        await handleOffer(data.offer, data.fromUserId);
      });

      socket.on('webrtc-answer', async (data: { answer: RTCSessionDescriptionInit; fromUserId: string }) => {
        console.log('Received answer from:', data.fromUserId);
        await handleAnswer(data.answer, data.fromUserId);
      });

      socket.on('webrtc-ice-candidate', async (data: { candidate: RTCIceCandidateInit; fromUserId: string }) => {
        console.log('Received ICE candidate from:', data.fromUserId);
        await handleIceCandidate(data.candidate, data.fromUserId);
      });

      // Handle user left
      socket.on('user-left', (data: { userId: string }) => {
        console.log('User left:', data.userId);
        cleanupPeerConnection(data.userId);
        setParticipants(prev => {
          const newMap = new Map(prev);
          newMap.delete(data.userId);
          return newMap;
        });
      });

      // Handle mute/unmute status
      socket.on('participant-muted', (data: { userId: string; isMuted: boolean }) => {
        setParticipants(prev => {
          const newMap = new Map(prev);
          const participant = newMap.get(data.userId);
          if (participant) {
            newMap.set(data.userId, { ...participant, isMuted: data.isMuted });
          }
          return newMap;
        });
      });

      // Handle video on/off status
      socket.on('participant-video-toggle', (data: { userId: string; isVideoOff: boolean }) => {
        setParticipants(prev => {
          const newMap = new Map(prev);
          const participant = newMap.get(data.userId);
          if (participant) {
            newMap.set(data.userId, { ...participant, isVideoOff: data.isVideoOff });
          }
          return newMap;
        });
      });

      socket.on('connect_error', (err) => {
        console.error('Socket connection error:', err);
        setError('Failed to connect to server');
      });
    }
  }, [roomId, userId, userName]);

  // Create peer connection
  const createPeerConnection = useCallback(async (remoteUserId: string, isInitiator: boolean = false) => {
    try {
      const peerConnection = new RTCPeerConnection(pcConfig);
      peersRef.current.set(remoteUserId, peerConnection);

      // Add local stream tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          peerConnection.addTrack(track, localStreamRef.current!);
        });
      }

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        console.log('Received remote stream from:', remoteUserId);
        const [remoteStream] = event.streams;
        
        setParticipants(prev => {
          const newMap = new Map(prev);
          const existing = newMap.get(remoteUserId) || {
            userId: remoteUserId,
            userName: `User ${remoteUserId}`,
            isMuted: false,
            isVideoOff: false,
            isHandRaised: false,
            isSpeaking: false
          };
          newMap.set(remoteUserId, { ...existing, stream: remoteStream });
          return newMap;
        });
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          socketRef.current.emit('webrtc-ice-candidate', {
            roomId,
            toUserId: remoteUserId,
            candidate: event.candidate
          });
        }
      };

      peerConnection.onconnectionstatechange = () => {
        console.log(`Peer connection state with ${remoteUserId}:`, peerConnection.connectionState);
      };

      // Create offer if initiator
      if (isInitiator) {
        const offer = await peerConnection.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
        await peerConnection.setLocalDescription(offer);
        
        if (socketRef.current) {
          socketRef.current.emit('webrtc-offer', {
            roomId,
            toUserId: remoteUserId,
            offer
          });
        }
      }

      return peerConnection;
    } catch (error) {
      console.error('Error creating peer connection:', error);
      setError('Failed to create peer connection');
      return null;
    }
  }, [roomId]);

  // Handle WebRTC offer
  const handleOffer = useCallback(async (offer: RTCSessionDescriptionInit, fromUserId: string) => {
    try {
      const peerConnection = await createPeerConnection(fromUserId, false);
      if (!peerConnection) return;

      await peerConnection.setRemoteDescription(offer);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      if (socketRef.current) {
        socketRef.current.emit('webrtc-answer', {
          roomId,
          toUserId: fromUserId,
          answer
        });
      }
    } catch (error) {
      console.error('Error handling offer:', error);
      setError('Failed to handle call offer');
    }
  }, [createPeerConnection, roomId]);

  // Handle WebRTC answer
  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit, fromUserId: string) => {
    try {
      const peerConnection = peersRef.current.get(fromUserId);
      if (peerConnection) {
        await peerConnection.setRemoteDescription(answer);
      }
    } catch (error) {
      console.error('Error handling answer:', error);
      setError('Failed to handle call answer');
    }
  }, []);

  // Handle ICE candidate
  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit, fromUserId: string) => {
    try {
      const peerConnection = peersRef.current.get(fromUserId);
      if (peerConnection && peerConnection.remoteDescription) {
        await peerConnection.addIceCandidate(candidate);
      }
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  }, []);

  // Cleanup peer connection
  const cleanupPeerConnection = useCallback((userId: string) => {
    const peerConnection = peersRef.current.get(userId);
    if (peerConnection) {
      peerConnection.close();
      peersRef.current.delete(userId);
    }
  }, []);

  // Initialize local media stream
  const initializeMedia = useCallback(async (video: boolean = true, audio: boolean = true) => {
    setIsConnecting(true);
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: video ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        } : false,
        audio: audio ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } : false
      });

      localStreamRef.current = stream;
      setLocalStream(stream);

      // Set local video
      if (localVideoRef.current && video) {
        localVideoRef.current.srcObject = stream;
      }

      // Initialize audio settings
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isMuted;
      }

      // Initialize video settings
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isVideoOff;
      }

      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      setError('Failed to access camera/microphone');
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, [isMuted, isVideoOff]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isMuted;
        setIsMuted(!isMuted);
        
        // Notify other participants
        if (socketRef.current) {
          socketRef.current.emit('participant-mute-toggle', {
            roomId,
            userId,
            isMuted: !isMuted
          });
        }
      }
    }
  }, [isMuted, roomId, userId]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = isVideoOff;
        setIsVideoOff(!isVideoOff);
        
        // Notify other participants
        if (socketRef.current) {
          socketRef.current.emit('participant-video-toggle', {
            roomId,
            userId,
            isVideoOff: !isVideoOff
          });
        }
      }
    }
  }, [isVideoOff, roomId, userId]);

  // Start screen sharing
  const startScreenShare = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      // Replace video track in all peer connections
      const videoTrack = screenStream.getVideoTracks()[0];
      peersRef.current.forEach(async (peerConnection) => {
        const sender = peerConnection.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );
        if (sender) {
          await sender.replaceTrack(videoTrack);
        }
      });

      // Update local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = screenStream;
      }

      setIsScreenSharing(true);

      // Handle screen share end
      videoTrack.onended = () => {
        stopScreenShare();
      };

      return screenStream;
    } catch (error) {
      console.error('Error starting screen share:', error);
      setError('Failed to start screen sharing');
      throw error;
    }
  }, []);

  // Stop screen sharing
  const stopScreenShare = useCallback(async () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      
      // Replace screen share with camera in all peer connections
      peersRef.current.forEach(async (peerConnection) => {
        const sender = peerConnection.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );
        if (sender && videoTrack) {
          await sender.replaceTrack(videoTrack);
        }
      });

      // Update local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }

      setIsScreenSharing(false);
    }
  }, []);

  // Join call
  const joinCall = useCallback(async (video: boolean = true, audio: boolean = true) => {
    try {
      initializeSocket();
      await initializeMedia(video, audio);
    } catch (error) {
      console.error('Error joining call:', error);
      setError('Failed to join call');
    }
  }, [initializeSocket, initializeMedia]);

  // Leave call
  const leaveCall = useCallback(() => {
    // Close all peer connections
    peersRef.current.forEach((peerConnection) => {
      peerConnection.close();
    });
    peersRef.current.clear();

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // Disconnect socket
    if (socketRef.current) {
      socketRef.current.emit('leave-webrtc-room', { roomId, userId });
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    setLocalStream(null);
    setParticipants(new Map());
    setIsMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
  }, [roomId, userId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      leaveCall();
    };
  }, [leaveCall]);

  return {
    // State
    localStream,
    participants,
    isMuted,
    isVideoOff,
    isScreenSharing,
    isConnecting,
    error,
    
    // Refs
    localVideoRef,
    
    // Actions
    joinCall,
    leaveCall,
    toggleMute,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    
    // Utilities
    clearError: () => setError(null)
  };
};