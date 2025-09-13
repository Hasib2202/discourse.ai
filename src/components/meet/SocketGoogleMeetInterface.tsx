// src/components/meet/SocketGoogleMeetInterface.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Settings,
  Users,
  Hand,
  ArrowLeft,
  Monitor,
  MessageSquare,
  Crown,
  AlertTriangle,
  Send,
  Radio,
} from "lucide-react";
import { toast } from "sonner";
import { useSocket } from "@/hooks/useSocket";
import TroubleshootingModal from "./TroubleshootingModal";

interface Participant {
  id: string;
  room_id: string;
  user_id: string;
  role: "host" | "participant";
  status: "joined" | "ready" | "speaking" | "muted";
  joined_at: string;
  ready_at?: string;
  is_online: boolean;
  profiles: {
    full_name: string;
    avatar_url?: string;
  };
}

interface User {
  id: string;
  email?: string;
}

interface SocketGoogleMeetInterfaceProps {
  roomId: string;
  currentUser: User;
  participants: Participant[];
  userDisplayName: string;
  onLeaveRoom: () => void;
}

// Extend window object for pending audio elements
declare global {
  interface Window {
    pendingAudioElements?: HTMLAudioElement[];
  }
}

export default function SocketGoogleMeetInterface({
  roomId,
  currentUser,
  participants,
  userDisplayName,
  onLeaveRoom,
}: SocketGoogleMeetInterfaceProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  // WebRTC Video Call State
  const [localVideoStream, setLocalVideoStream] = useState<MediaStream | null>(
    null
  );
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(
    new Map()
  );
  const [isVideoCallActive, setIsVideoCallActive] = useState(false);
  const [videoCallError, setVideoCallError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [showParticipants, setShowParticipants] = useState(false);
  // const [showSettings, setShowSettings] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const [] = useState(false);

  // New features state
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<
    Array<{
      id: string;
      userId: string;
      userName: string;
      message: string;
      timestamp: number;
    }>
  >([]);
  const [newMessage, setNewMessage] = useState("");
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  // Speaking detection state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speakingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSpeakingStatusRef = useRef<boolean>(false);

  // Browser compatibility check
  const [compatibility] = useState(() => {
    const issues = [];

    // Check if we're on mobile
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        typeof navigator !== "undefined" ? navigator.userAgent : ""
      );

    // Check if we're on iOS
    const isIOS = /iPad|iPhone|iPod/.test(
      typeof navigator !== "undefined" ? navigator.userAgent : ""
    );

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (isMobile) {
        issues.push("Mobile browser doesn't support microphone access");
      } else {
        issues.push("Microphone access not supported");
      }
    }

    if (
      !window.AudioContext &&
      !(window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    ) {
      if (isMobile) {
        issues.push("Mobile audio processing not supported");
      } else {
        issues.push("Audio processing not supported");
      }
    }

    if (!window.WebSocket) {
      issues.push("Real-time communication not supported");
    }

    // Check for HTTPS requirement (stricter for mobile)
    if (
      typeof window !== "undefined" &&
      window.location.protocol !== "https:" &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1"
    ) {
      if (isMobile) {
        issues.push("Mobile browsers require HTTPS for microphone access");
      } else {
        issues.push("Microphone requires HTTPS connection");
      }
    }

    // iOS specific checks
    if (isIOS) {
      // iOS Safari requires user gesture for audio
      if (
        typeof window !== "undefined" &&
        !window.location.href.includes("https://")
      ) {
        issues.push("iOS requires HTTPS and user interaction for audio");
      }
    }

    return {
      isCompatible: issues.length === 0,
      issues: issues,
      isMobile,
      isIOS,
    };
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  // WebRTC refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(
    new Map()
  );

  // Audio-only WebRTC refs (separate from video)
  const audioPeerConnections = useRef<Map<string, RTCPeerConnection>>(
    new Map()
  );
  const audioPendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(
    new Map()
  );
  const remoteAudioStreams = useRef<Map<string, MediaStream>>(new Map());

  // Real-time participants state (combines database + socket participants)
  const [realTimeParticipants, setRealTimeParticipants] =
    useState<Participant[]>(participants);

  // Use Socket.IO hook
  const {
    isConnected,
    participants: socketParticipants,
    participantStatus,
    sendChatMessage,
    sendSpeakingStatus,
    sendAudioData,
    updateAudioStatus,
    toggleHandRaise,
    socketRef,
  } = useSocket({
    roomId,
    userId: currentUser.id,
    userName: userDisplayName,
  });

  // Update real-time participants when socket participants change
  useEffect(() => {
    console.log("🔄 Updating real-time participants:");
    console.log("- Database participants:", participants.length);
    console.log("- Socket participants:", socketParticipants.length);

    // Create a map of current participants from database
    const participantMap = new Map(participants.map((p) => [p.user_id, p]));

    // Add any socket participants that might not be in the database yet
    const updatedParticipants = [...participants];

    socketParticipants.forEach((userId) => {
      if (!participantMap.has(userId)) {
        // Create a temporary participant entry for socket-only users
        const tempParticipant: Participant = {
          id: `temp-${userId}`,
          room_id: roomId,
          user_id: userId,
          role: "participant",
          status: "joined",
          joined_at: new Date().toISOString(),
          is_online: true,
          profiles: {
            full_name: `User ${userId.slice(0, 8)}`, // Show first 8 chars of user ID
            avatar_url: undefined,
          },
        };
        updatedParticipants.push(tempParticipant);
        console.log(
          "➕ Added socket participant:",
          tempParticipant.profiles.full_name
        );
      }
    });

    // Show all database participants, mark online status based on socket presence
    const activeParticipants = updatedParticipants.map((p) => ({
      ...p,
      is_online: socketParticipants.includes(p.user_id),
    }));

    console.log("✅ Final active participants:", activeParticipants.length);
    setRealTimeParticipants(activeParticipants);
  }, [participants, socketParticipants, roomId]);

  // Simple microphone permission test
  const requestMicrophonePermission = useCallback(async () => {
    try {
      console.log("🎤 Testing microphone access...");

      // Simple, direct microphone request
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      console.log("✅ Microphone permission granted!");

      // Stop the test stream immediately
      stream.getTracks().forEach((track) => track.stop());

      toast.success("Microphone permission granted!");
      return true;
    } catch (error: unknown) {
      console.error("❌ Microphone permission denied:", error);

      let errorMessage = "Microphone access failed: ";

      if (error instanceof DOMException) {
        if (error.name === "NotAllowedError") {
          errorMessage +=
            "Please click 'Allow' when the browser asks for microphone permission.";
        } else if (error.name === "NotFoundError") {
          errorMessage += "No microphone found. Please connect a microphone.";
        } else if (error.name === "NotSupportedError") {
          errorMessage += "Your browser doesn't support microphone access.";
        } else {
          errorMessage += error.message || "Unknown error occurred.";
        }
      } else if (error instanceof Error) {
        errorMessage += error.message;
      } else {
        errorMessage += "Unknown error occurred.";
      }

      toast.error(errorMessage);
      return false;
    }
  }, []);

  // Initialize microphone and audio capture
  const initializeMicrophone = useCallback(async () => {
    try {
      console.log("🎤 Requesting microphone access...");

      // Check browser compatibility first
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Browser doesn't support microphone access");
      }

      // Stop any existing streams first
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        console.log("🔄 Stopped existing audio stream");
      }

      // Mobile-specific audio constraints
      const isMobile =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        );
      const audioConstraints = isMobile
        ? {
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              // Use lower sample rate for mobile
              sampleRate: 22050,
              // Reduce latency for mobile
              latency: 0.1,
            },
          }
        : {
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: 44100,
            },
          };

      console.log(
        `🔧 Using ${isMobile ? "mobile" : "desktop"} audio constraints`
      );

      const stream = await navigator.mediaDevices.getUserMedia(
        audioConstraints
      );
      mediaStreamRef.current = stream;
      console.log(
        "✅ Got media stream with",
        stream.getAudioTracks().length,
        "audio tracks"
      );

      // Use AudioContext or webkitAudioContext
      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error("Browser doesn't support audio processing");
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass();
        console.log("🔊 Created new AudioContext");
      }

      // Resume AudioContext if suspended (required for user interaction)
      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
        console.log("▶️ Resumed AudioContext");
      }

      console.log("🎧 AudioContext state:", audioContextRef.current.state);

      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(
        1024,
        1,
        1
      );
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        if (!isMuted && isStreaming && isConnected && mediaStreamRef.current) {
          const inputBuffer = event.inputBuffer;
          const inputData = inputBuffer.getChannelData(0);

          // Calculate audio level
          let sum = 0;
          for (let i = 0; i < inputData.length; i++) {
            sum += inputData[i] * inputData[i];
          }
          const level = Math.sqrt(sum / inputData.length) * 100;
          setAudioLevel(level);

          // Debug: Log audio levels more frequently for testing
          if (Math.random() < 0.05) {
            // 5% chance = roughly every 20 frames
            console.log(
              `🎵 Audio level: ${level.toFixed(2)} (threshold: 5, speaking: ${
                level > 5
              }, stream active: ${
                mediaStreamRef.current.getAudioTracks()[0]?.enabled
              })`
            );
          }

          // Speaking detection with moderate threshold and debouncing
          const speakingThreshold = 5; // Increase threshold for more reliable detection
          const currentlySpeaking = level > speakingThreshold;

          // Clear any existing timeout
          if (speakingTimeoutRef.current) {
            clearTimeout(speakingTimeoutRef.current);
          }

          if (currentlySpeaking) {
            // User is currently speaking
            if (!lastSpeakingStatusRef.current) {
              // Just started speaking
              console.log(
                `🗣️ ${userDisplayName} started speaking (volume: ${level.toFixed(
                  1
                )})`
              );

              setIsSpeaking(true);
              // Don't manage local speakingParticipants, let socket handle it

              // Send speaking status to other participants
              if (socketRef.current) {
                sendSpeakingStatus(true, level);
              }

              lastSpeakingStatusRef.current = true;
            }

            // Set timeout to stop speaking detection after silence
            speakingTimeoutRef.current = setTimeout(() => {
              console.log(`🤐 ${userDisplayName} stopped speaking`);

              setIsSpeaking(false);
              // Don't manage local speakingParticipants, let socket handle it

              // Send stop speaking status
              if (socketRef.current) {
                sendSpeakingStatus(false, 0);
              }

              lastSpeakingStatusRef.current = false;
            }, 300); // Shorter timeout for more responsive detection
          }

          // Convert to ArrayBuffer and send
          const targetBuffer = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            targetBuffer[i] = Math.max(
              -32768,
              Math.min(32767, inputData[i] * 32767)
            );
          }

          sendAudioData(targetBuffer.buffer);
        }
      };

      source.connect(processor);
      processor.connect(audioContextRef.current.destination);

      // Ensure audio tracks are enabled
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        audioTracks[0].enabled = true;
        console.log("✅ Audio track enabled:", audioTracks[0].label);
      }

      console.log("✅ Microphone initialized successfully");
      toast.success("Microphone connected");
    } catch (error: unknown) {
      console.error("❌ Failed to initialize microphone:", error);

      // Get mobile detection from compatibility state
      const isMobile = compatibility.isMobile;
      const isIOS = compatibility.isIOS;

      let errorMessage = "Failed to access microphone. ";

      if (
        error instanceof Error &&
        (error.name === "NotAllowedError" ||
          error.name === "PermissionDeniedError")
      ) {
        if (isMobile) {
          errorMessage +=
            "Please allow microphone access in your mobile browser settings and refresh the page.";
        } else {
          errorMessage +=
            "Please allow microphone access and refresh the page.";
        }
      } else if (
        error instanceof Error &&
        (error.name === "NotFoundError" ||
          error.name === "DevicesNotFoundError")
      ) {
        if (isMobile) {
          errorMessage += "No microphone found on your mobile device.";
        } else {
          errorMessage += "No microphone found. Please connect a microphone.";
        }
      } else if (error instanceof Error && error.name === "NotSupportedError") {
        if (isMobile) {
          errorMessage +=
            "Your mobile browser doesn't support audio recording. Try using Chrome or Safari.";
        } else {
          errorMessage += "Your browser doesn't support audio recording.";
        }
      } else if (
        error instanceof Error &&
        error.message.includes("Browser doesn't support")
      ) {
        if (isMobile) {
          errorMessage +=
            "Mobile " +
            (error instanceof Error ? error.message.toLowerCase() : "error") +
            ". Try using the latest Chrome or Safari mobile.";
        } else {
          errorMessage +=
            (error instanceof Error ? error.message : "Unknown error") +
            ". Try using Chrome, Firefox, or Safari.";
        }
      } else if (
        window.location.protocol !== "https:" &&
        window.location.hostname !== "localhost"
      ) {
        if (isMobile) {
          errorMessage +=
            "Mobile browsers require HTTPS for microphone access. Please use a secure connection.";
        } else {
          errorMessage +=
            "Microphone requires HTTPS. Please use a secure connection.";
        }
      } else {
        if (isMobile && isIOS) {
          errorMessage +=
            "iOS requires user interaction and HTTPS for audio. Please try tapping the microphone button and ensure you're on HTTPS.";
        } else if (isMobile) {
          errorMessage +=
            "Please check your mobile browser settings and microphone permissions.";
        } else {
          errorMessage += "Please check your microphone and browser settings.";
        }
      }

      toast.error(errorMessage);
    }
  }, [
    isMuted,
    isStreaming,
    isConnected,
    sendAudioData,
    sendSpeakingStatus,
    compatibility.isMobile,
    compatibility.isIOS,
    currentUser.id,
    roomId,
    socketRef,
    userDisplayName,
  ]);

  // Mobile-specific microphone initialization
  const initializeMobileAudio = useCallback(async () => {
    try {
      console.log("📱 Mobile audio initialization started...");

      // Check if it's actually mobile
      const isMobile =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        );

      if (isMobile) {
        console.log("🔍 Checking microphone permissions...");

        // First, check current permission status
        if (navigator.permissions) {
          try {
            const permissionStatus = await navigator.permissions.query({
              name: "microphone" as PermissionName,
            });
            console.log(
              `🎤 Current microphone permission: ${permissionStatus.state}`
            );

            if (permissionStatus.state === "denied") {
              throw new Error(
                "Microphone permission has been denied. Please enable it in browser settings."
              );
            }
          } catch (permError) {
            console.log(
              "⚠️ Permission query not supported, proceeding with direct access..."
            );
          }
        }

        // Progressive constraint fallback for mobile
        const constraintSets = [
          // Try most basic first
          { audio: true },
          // Try with minimal options
          { audio: { echoCancellation: false } },
          // Try with mobile-optimized settings
          {
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
              sampleRate: 16000,
            },
          },
        ];

        let stream = null;
        let lastError = null;

        for (let i = 0; i < constraintSets.length; i++) {
          try {
            console.log(
              `📱 Trying constraint set ${i + 1}:`,
              constraintSets[i]
            );
            stream = await navigator.mediaDevices.getUserMedia(
              constraintSets[i]
            );
            console.log(
              `✅ Mobile microphone access granted with constraint set ${i + 1}`
            );
            break;
          } catch (error) {
            console.log(`❌ Constraint set ${i + 1} failed:`, error);
            lastError = error;

            // If it's a permission error, don't try other constraints
            if (
              error instanceof Error &&
              (error.name === "NotAllowedError" ||
                error.name === "PermissionDeniedError")
            ) {
              throw error;
            }
          }
        }

        if (!stream) {
          throw (
            lastError ||
            new Error("Unable to access microphone with any constraint set")
          );
        }

        // Store the stream
        mediaStreamRef.current = stream;

        // For mobile, use a simpler approach without AudioContext processing
        // Just store the stream and mark as initialized
        toast.success("Mobile microphone connected!");
        return stream;
      } else {
        // Use regular initialization for desktop
        return await initializeMicrophone();
      }
    } catch (error: unknown) {
      console.error("❌ Mobile audio initialization failed:", error);

      // Provide mobile-specific error messages
      let errorMessage = "Mobile microphone access failed. ";

      if (error instanceof Error && error.name === "NotAllowedError") {
        errorMessage +=
          "Please tap 'Allow' when Chrome asks for microphone permission.";
      } else if (error instanceof Error && error.name === "NotFoundError") {
        errorMessage += "No microphone found on your device.";
      } else if (error instanceof Error && error.name === "NotSupportedError") {
        errorMessage +=
          "Your mobile browser doesn't support audio recording. Try updating Chrome.";
      } else {
        errorMessage +=
          "Try refreshing the page and allowing microphone access.";
      }

      toast.error(errorMessage);
      throw error;
    }
  }, [initializeMicrophone]);

  // Create audio-only peer connection for voice communication
  const createAudioPeerConnection = useCallback(
    (remoteUserId: string) => {
      console.log(`🎤 Creating audio peer connection for ${remoteUserId}`);

      // Close existing audio peer connection if it exists
      const existingPc = audioPeerConnections.current.get(remoteUserId);
      if (existingPc) {
        console.log(
          `🔄 Closing existing audio peer connection for ${remoteUserId}`
        );
        existingPc.close();
        audioPeerConnections.current.delete(remoteUserId);
        audioPendingCandidates.current.delete(remoteUserId);
      }

      const pc = new RTCPeerConnection(rtcConfig);
      audioPeerConnections.current.set(remoteUserId, pc);

      // Add local audio stream if available
      if (mediaStreamRef.current) {
        const audioTracks = mediaStreamRef.current.getAudioTracks();
        audioTracks.forEach((track) => {
          console.log(
            `📤 Adding audio track to peer connection for ${remoteUserId}`
          );
          pc.addTrack(track, mediaStreamRef.current!);
        });
      }

      // Handle remote audio stream
      pc.ontrack = (event) => {
        console.log(`🔊 Received remote audio stream from ${remoteUserId}`, {
          streams: event.streams.length,
          tracks: event.streams[0]?.getTracks().length || 0,
        });

        if (event.streams[0]) {
          const remoteStream = event.streams[0];
          remoteAudioStreams.current.set(remoteUserId, remoteStream);

          // Create audio element to play remote audio
          const audioElement = new Audio();
          audioElement.srcObject = remoteStream;
          audioElement.autoplay = true;
          audioElement.muted = false;

          // Try to play with user gesture fallback
          const playAudio = async () => {
            try {
              await audioElement.play();
              console.log(`✅ Playing remote audio from ${remoteUserId}`);
            } catch (e) {
              console.warn(
                `⚠️ Auto-play blocked for ${remoteUserId}, will try on next user interaction:`,
                e
              );
              // Store reference for later manual play trigger
              if (!window.pendingAudioElements) {
                window.pendingAudioElements = [];
              }
              window.pendingAudioElements.push(audioElement);
            }
          };

          playAudio();

          console.log(`✅ Remote audio stream set up for ${remoteUserId}`);
        }
      };

      // Handle ICE candidates for audio connection
      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          console.log(`🧊 Sending audio ICE candidate to ${remoteUserId}`);
          socketRef.current.emit("audio-webrtc-ice-candidate", {
            roomId,
            toUserId: remoteUserId,
            candidate: event.candidate,
          });
        }
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log(
          `Audio connection state with ${remoteUserId}: ${pc.connectionState}`
        );
      };

      return pc;
    },
    [roomId, socketRef]
  );

  // Start audio streaming
  const startAudioStreaming = useCallback(async () => {
    try {
      console.log("🎙️ Starting audio streaming process...");

      // Step 1: Test microphone permission first
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) {
        throw new Error("Microphone permission denied");
      }

      // Step 2: Detect if mobile and use appropriate initialization
      const isMobile =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        );

      if (isMobile) {
        console.log("📱 Using mobile audio initialization...");
        await initializeMobileAudio();
      } else {
        console.log("🖥️ Using desktop audio initialization...");
        await initializeMicrophone();
      }

      // Step 3: Create audio peer connections with other participants for voice communication
      console.log("🔗 Establishing audio connections with participants...");
      const otherParticipants = socketParticipants.filter(
        (id) => id !== currentUser.id
      );

      for (const participantId of otherParticipants) {
        console.log(`🎤 Creating audio connection with ${participantId}`);
        const pc = createAudioPeerConnection(participantId);

        if (pc) {
          try {
            // Create offer for audio connection
            console.log(`📞 Creating audio offer for ${participantId}`);
            const offer = await pc.createOffer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: false, // Audio only
            });

            await pc.setLocalDescription(offer);

            // Send offer via Socket.IO
            if (socketRef.current) {
              socketRef.current.emit("audio-webrtc-offer", {
                roomId,
                toUserId: participantId,
                offer,
              });
            }
          } catch (error) {
            console.error(
              `❌ Failed to create audio offer for ${participantId}:`,
              error
            );
          }
        }
      }

      setIsStreaming(true);
      updateAudioStatus(isMuted, true);
      console.log("🎙️ Audio streaming started with peer connections");
      toast.success("Voice communication enabled");
    } catch (error) {
      console.error("❌ Failed to start audio streaming:", error);
      toast.error("Failed to access microphone. Please check permissions.");
    }
  }, [
    requestMicrophonePermission,
    initializeMicrophone,
    initializeMobileAudio,
    isMuted,
    updateAudioStatus,
    socketParticipants,
    currentUser.id,
    createAudioPeerConnection,
    roomId,
    socketRef,
  ]);

  // Auto-start audio streaming when minimum people present
  useEffect(() => {
    console.log(
      "🎤 Checking auto-start conditions:",
      "participants =",
      realTimeParticipants.length,
      "isStreaming =",
      isStreaming,
      "socketParticipants =",
      socketParticipants.length
    );

    if (realTimeParticipants.length >= 2 && !isStreaming) {
      console.log(
        "🎤 Auto-starting audio streaming with",
        realTimeParticipants.length,
        "participants"
      );
      startAudioStreaming();
    }
  }, [
    realTimeParticipants.length,
    isStreaming,
    startAudioStreaming,
    socketParticipants.length,
  ]);


  // Toggle mute
  const toggleMute = async () => {
    if (!isStreaming) {
      await startAudioStreaming();
      return;
    }

    const newMutedState = !isMuted;
    setIsMuted(newMutedState);

    // Control the actual audio track in mediaStreamRef
    if (mediaStreamRef.current) {
      const audioTracks = mediaStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        audioTracks[0].enabled = !newMutedState;
        console.log(`🎤 mediaStreamRef audio track ${newMutedState ? "muted" : "unmuted"}`);
      }
    }

    // Video stream is separate - no audio tracks to manage in localVideoStream

    updateAudioStatus(newMutedState, isStreaming);
    toast.info(newMutedState ? "Microphone muted" : "Microphone unmuted");
  };

  // Toggle hand raise
  const handleHandRaise = () => {
    const newHandRaised = !handRaised;
    setHandRaised(newHandRaised);
    toggleHandRaise(newHandRaised);
  };

  // Manual permission trigger for mobile devices
  const requestMobilePermission = useCallback(async () => {
    try {
      console.log("📱 Manual mobile permission request...");

      // Force permission dialog with minimal constraints
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      console.log("✅ Mobile permission granted manually");

      // Stop the test stream
      stream.getTracks().forEach((track) => track.stop());

      toast.success("Permission granted! Now starting audio...");

      // Now try the full initialization
      await startAudioStreaming();
    } catch (error) {
      console.error("❌ Manual permission request failed:", error);

      let errorMessage = "Permission request failed. ";

      if (error instanceof Error) {
        if (error.name === "NotAllowedError") {
          errorMessage +=
            "Please tap 'Allow' when Chrome asks for microphone permission.";
        } else if (error.name === "NotFoundError") {
          errorMessage += "No microphone found on your device.";
        } else {
          errorMessage +=
            "Please check your microphone settings and try again.";
        }
      }

      toast.error(errorMessage);
    }
  }, [startAudioStreaming]);

  // Update speaking participants from socket hook data
  useEffect(() => {
    const speakingIds = new Set<string>();
    for (const [userId, status] of participantStatus) {
      if (status.isSpeaking) {
        speakingIds.add(userId);
      }
    }
    // No longer need to manage local speaking participants state
  }, [participantStatus]);

  // Socket chat message handler
  useEffect(() => {
    if (!socketRef.current) return;

    const socket = socketRef.current;

    // Listen for chat messages from useSocket hook
    socket.on(
      "chat-message",
      (data: {
        id?: string;
        userId: string;
        userName: string;
        message: string;
        timestamp: string | number;
      }) => {
        console.log(`💬 Chat message from ${data.userName}: ${data.message}`);

        const chatMessage = {
          id: data.id || `${data.userId}-${Date.now()}-${Math.random()}`,
          userId: data.userId,
          userName: data.userName,
          message: data.message,
          timestamp:
            typeof data.timestamp === "string"
              ? new Date(data.timestamp).getTime()
              : data.timestamp,
        };

        setChatMessages((prev) => [...prev, chatMessage]);

        // Only increment unread count if chat is not open and it's not from current user
        if (!showChat && data.userId !== currentUser.id) {
          setUnreadMessageCount((prev) => prev + 1);
        }
      }
    );

    return () => {
      socket.off("chat-message");
    };
  }, [socketRef, showChat, currentUser.id]);

  // Send chat message
  const handleSendChatMessage = useCallback(() => {
    if (!newMessage.trim()) return;

    console.log(`📤 Sending chat message: ${newMessage}`);

    // Use the sendChatMessage function from useSocket hook
    sendChatMessage(newMessage);
    setNewMessage("");
  }, [newMessage, sendChatMessage]);

  // Reset unread count when chat is opened
  useEffect(() => {
    if (showChat) {
      setUnreadMessageCount(0);
    }
  }, [showChat]);

  // ===== WebRTC Video Call Functions =====

  // WebRTC configuration
  const rtcConfig = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

  // Start video call
  const startVideoCall = useCallback(async () => {
    try {
      console.log("🎥 Starting video call...", {
        userId: currentUser.id,
        userName: userDisplayName,
        socketParticipants: socketParticipants.length,
        participants: socketParticipants,
        isStreaming,
        hasExistingAudio: !!mediaStreamRef.current,
      });
      setVideoCallError(null);

      console.log("🎥 Getting video-only stream...");

      // Always get only video stream - no audio
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: false, // Never get audio for video calls
      });

      console.log("📹 Video-only stream obtained successfully");

      setLocalVideoStream(videoStream);
      setIsVideoCallActive(true);
      setIsVideoOn(true);

      // Video element will be set via useEffect after render

      // Notify other participants about video call
      if (socketRef.current) {
        console.log("📡 Emitting video-call-start event");
        socketRef.current.emit("video-call-start", {
          roomId,
          userId: currentUser.id,
          userName: userDisplayName,
        });
      }

      // IMPORTANT: Create peer connections for all existing participants in the room
      // This ensures that when we start video call, we connect to participants already present
      console.log(
        "🔗 CLAUDE FIX: Creating peer connections for existing participants..."
      );
      console.log(
        "👥 CLAUDE FIX: Current socket participants:",
        socketParticipants
      );

      // Additional debugging - emit this to server so we can see it in server logs
      if (socketRef.current) {
        socketRef.current.emit("debug-log", {
          message: `🔗 CLAUDE DEBUG: ${userDisplayName} about to create peer connections`,
          participants: socketParticipants,
          participantCount: socketParticipants.length,
        });
      }

      for (const participantId of socketParticipants) {
        if (participantId !== currentUser.id) {
          console.log(
            `🤝 Creating peer connection for existing participant: ${participantId}`
          );

          // Emit to server for debugging
          if (socketRef.current) {
            socketRef.current.emit("debug-log", {
              message: `🤝 ${userDisplayName} creating peer connection for ${participantId}`,
              fromUser: currentUser.id,
              toUser: participantId,
            });
          }

          const pc = createPeerConnection(participantId);

          if (pc) {
            console.log(`✅ Peer connection created for ${participantId}`);

            // Add only video tracks to peer connection (no audio)
            videoStream.getTracks().forEach((track) => {
              console.log(
                `📤 Adding ${track.kind} track to peer connection for ${participantId}`
              );
              pc.addTrack(track, videoStream);
            });

            // Create and send offer to all existing participants (we're starting the video call)
            try {
              console.log(`📞 Creating and sending offer to ${participantId}`);
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);

              socketRef.current?.emit("webrtc-offer", {
                roomId,
                toUserId: participantId,
                offer: offer,
              });

              console.log(`✅ Offer sent to ${participantId}`);
            } catch (error) {
              console.error(
                `❌ Error creating offer for ${participantId}:`,
                error
              );
            }
          } else {
            console.error(
              `❌ Failed to create peer connection for ${participantId}`
            );
          }
        }
      }

      console.log("✅ Video call started successfully");
      console.log("📹 Local video element:", localVideoRef.current);
      console.log(
        "📹 Local video stream tracks:",
        videoStream.getTracks().map((t) => `${t.kind}: ${t.enabled}`)
      );
      toast.success("Video call started!");
    } catch (error) {
      console.error("❌ Failed to start video call:", error);
      let errorMessage = "Failed to start video call: ";

      if (error instanceof DOMException) {
        if (error.name === "NotAllowedError") {
          errorMessage += "Please allow camera and microphone access";
        } else if (error.name === "NotFoundError") {
          errorMessage += "Camera or microphone not found";
        } else if (error.name === "AbortError") {
          errorMessage +=
            "Starting video input failed. Try refreshing the page.";
        } else {
          errorMessage += error.message || "Unknown error";
        }
      } else {
        errorMessage += "Unknown error occurred";
      }

      setVideoCallError(errorMessage);
      toast.error(errorMessage);
    }
  }, [roomId, currentUser.id, userDisplayName, socketRef, socketParticipants]);

  // Stop video call
  const stopVideoCall = useCallback(() => {
    console.log("🛑 Stopping video call...");

    // Stop video tracks (video-only, no audio tracks to handle)
    if (localVideoStream) {
      localVideoStream.getTracks().forEach((track) => {
        console.log(`🛑 Stopping ${track.kind} track`);
        track.stop();
      });

      setLocalVideoStream(null);
    }

    // Close all peer connections
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();

    // Clear remote streams
    setRemoteStreams(new Map());

    setIsVideoCallActive(false);
    setIsVideoOn(false);

    // Notify other participants
    if (socketRef.current) {
      socketRef.current.emit("video-call-stop", {
        roomId,
        userId: currentUser.id,
      });
    }

    toast.info("Video call stopped - Audio streaming continues independently");
  }, [localVideoStream, roomId, currentUser.id, socketRef]);

  // Create peer connection
  const createPeerConnection = useCallback(
    (remoteUserId: string) => {
      console.log(`🤝 Creating peer connection for ${remoteUserId}`);

      // Close existing peer connection if it exists
      const existingPc = peerConnections.current.get(remoteUserId);
      if (existingPc) {
        console.log(`🔄 Closing existing peer connection for ${remoteUserId}`);
        existingPc.close();
        peerConnections.current.delete(remoteUserId);
        pendingCandidates.current.delete(remoteUserId);
      }

      const pc = new RTCPeerConnection(rtcConfig);
      peerConnections.current.set(remoteUserId, pc);

      // Add local video stream (video-only, no audio)
      if (localVideoStream) {
        localVideoStream.getTracks().forEach((track) => {
          console.log(`📤 Adding ${track.kind} track to peer connection for ${remoteUserId}`);
          pc.addTrack(track, localVideoStream);
        });
      }

      // Handle remote stream
      pc.ontrack = (event) => {
        console.log(`📺 Received remote stream from ${remoteUserId}`, {
          streams: event.streams.length,
          tracks:
            event.streams[0]
              ?.getTracks()
              .map((t) => `${t.kind}: ${t.enabled}`) || [],
          streamActive: event.streams[0]?.active,
        });
        const [remoteStream] = event.streams;
        if (remoteStream) {
          setRemoteStreams((prev) => {
            const newMap = new Map(prev.set(remoteUserId, remoteStream));
            console.log(
              `🗂️ Remote streams updated:`,
              Array.from(newMap.keys())
            );
            return newMap;
          });
        } else {
          console.warn(`⚠️ No remote stream received from ${remoteUserId}`);
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          console.log(`🧊 Sending ICE candidate to ${remoteUserId}`);
          socketRef.current.emit("webrtc-ice-candidate", {
            roomId,
            toUserId: remoteUserId,
            candidate: event.candidate,
          });
        }
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log(
          `Connection state with ${remoteUserId}: ${pc.connectionState}`
        );
      };

      return pc;
    },
    [localVideoStream, roomId, socketRef]
  );

  // Stop audio streaming and close audio peer connections
  const stopAudioStreaming = useCallback(() => {
    console.log("🔇 Stopping audio streaming...");

    // Close all audio peer connections
    audioPeerConnections.current.forEach((pc, userId) => {
      console.log(`🔌 Closing audio connection with ${userId}`);
      pc.close();
    });
    audioPeerConnections.current.clear();
    audioPendingCandidates.current.clear();
    remoteAudioStreams.current.clear();

    // Stop local audio stream
    if (mediaStreamRef.current) {
      const audioTracks = mediaStreamRef.current.getAudioTracks();
      audioTracks.forEach((track) => {
        console.log("🛑 Stopping audio track");
        track.stop();
      });
    }

    setIsStreaming(false);
    updateAudioStatus(false, false);
    console.log("🔇 Audio streaming stopped");
    toast.info("Voice communication stopped");
  }, [updateAudioStatus]);

  // Try to play any pending audio elements on user interaction
  const tryPlayPendingAudio = useCallback(() => {
    if (window.pendingAudioElements && window.pendingAudioElements.length > 0) {
      console.log(
        `🎵 Attempting to play ${window.pendingAudioElements.length} pending audio elements`
      );
      window.pendingAudioElements.forEach(async (audioElement, index) => {
        try {
          await audioElement.play();
          console.log(`✅ Successfully played pending audio element ${index}`);
        } catch (e) {
          console.warn(`⚠️ Still cannot play audio element ${index}:`, e);
        }
      });
      // Clear the pending array
      window.pendingAudioElements = [];
    }
  }, []);

  // Set local video stream when element is available
  useEffect(() => {
    if (localVideoRef.current && localVideoStream) {
      console.log("📺 Setting local video stream to element");
      localVideoRef.current.srcObject = localVideoStream;

      // Add event listeners for debugging
      localVideoRef.current.onloadedmetadata = () => {
        console.log("✅ Local video metadata loaded");
        localVideoRef.current
          ?.play()
          .catch((e) => console.error("❌ Video play error:", e));
      };

      localVideoRef.current.onerror = (e) => {
        console.error("❌ Local video error:", e);
      };

      console.log(
        "📺 Local video srcObject set, stream active:",
        localVideoStream.active
      );
    }
  }, [localVideoStream]);

  // Handle WebRTC signaling via Socket.IO
  useEffect(() => {
    if (!socketRef.current) return;

    const socket = socketRef.current;
    console.log("🔧 Setting up WebRTC event handlers for socket:", socket.id);

    // Handle user joining video call
    socket.on(
      "video-call-user-joined",
      async (data: { userId: string; userName: string }) => {
        try {
          console.log(`📺 Received video-call-user-joined event:`, data);
          console.log(
            `🔍 Current user: ${currentUser.id}, Event user: ${data.userId}`
          );
          console.log(
            `🎥 Local video call active: ${isVideoCallActive}, Local stream: ${!!localVideoStream}`
          );

          if (data.userId !== currentUser.id) {
            console.log(
              `👋 ${data.userName} joined video call, creating peer connection`
            );

            const pc = createPeerConnection(data.userId);

            if (pc) {
              console.log(
                `✅ Peer connection created successfully for ${data.userId}`
              );
              try {
                // Always create offers when someone joins - both sides can create offers
                console.log(
                  `📞 Creating offer for ${data.userId} who joined the video call`
                );
                const offer = await pc.createOffer({
                  offerToReceiveAudio: true,
                  offerToReceiveVideo: true,
                });
                console.log(
                  `🔧 Offer created:`,
                  offer.type,
                  offer.sdp?.substring(0, 100) + "..."
                );
                await pc.setLocalDescription(offer);
                console.log(
                  `🔧 Local description set, signaling state:`,
                  pc.signalingState
                );

                console.log(`📡 Sending offer to ${data.userId}`);
                socket.emit("webrtc-offer", {
                  roomId,
                  toUserId: data.userId,
                  offer,
                });
                console.log(`📡 Offer sent to server`);
              } catch (error) {
                console.error("❌ Error creating offer:", error);
              }
            } else {
              console.error(
                `❌ Failed to create peer connection for ${data.userId}`
              );
            }
          } else {
            console.log(`⏭️ Skipping own user: ${data.userId}`);
          }
        } catch (error) {
          console.error(
            "❌ CRITICAL ERROR in video-call-user-joined handler:",
            error
          );
        }
      }
    );

    // Handle WebRTC offer
    socket.on(
      "webrtc-offer",
      async (data: {
        offer: RTCSessionDescriptionInit;
        fromUserId: string;
      }) => {
        console.log(`📞 Received offer from ${data.fromUserId}`);

        try {
          const pc = createPeerConnection(data.fromUserId);
          if (!pc) {
            console.error("❌ Failed to create peer connection for offer");
            return;
          }

          console.log(`📥 Setting remote description for ${data.fromUserId}`);
          await pc.setRemoteDescription(data.offer);

          // Add pending ICE candidates
          const pending = pendingCandidates.current.get(data.fromUserId) || [];
          console.log(`🧊 Adding ${pending.length} pending ICE candidates`);
          for (const candidate of pending) {
            await pc.addIceCandidate(candidate);
          }
          pendingCandidates.current.delete(data.fromUserId);

          // Create answer
          console.log(`📞 Creating answer for ${data.fromUserId}`);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          console.log(`📡 Sending answer to ${data.fromUserId}`);
          socket.emit("webrtc-answer", {
            roomId,
            toUserId: data.fromUserId,
            answer,
          });
        } catch (error) {
          console.error("❌ Error handling offer:", error);
        }
      }
    );

    // Handle WebRTC answer
    socket.on(
      "webrtc-answer",
      async (data: {
        answer: RTCSessionDescriptionInit;
        fromUserId: string;
      }) => {
        console.log(`📞 Received answer from ${data.fromUserId}`);

        try {
          const pc = peerConnections.current.get(data.fromUserId);
          if (pc) {
            console.log(`🔄 Peer connection state: ${pc.signalingState}`);

            // Only set remote description if we're in the correct state (have-local-offer)
            if (pc.signalingState === "have-local-offer") {
              console.log(`✅ Setting remote answer for ${data.fromUserId}`);
              await pc.setRemoteDescription(data.answer);

              // Add pending ICE candidates
              const pending =
                pendingCandidates.current.get(data.fromUserId) || [];
              console.log(`🧊 Adding ${pending.length} pending ICE candidates`);
              for (const candidate of pending) {
                await pc.addIceCandidate(candidate);
              }
              pendingCandidates.current.delete(data.fromUserId);
            } else {
              console.warn(
                `⚠️ Cannot set remote answer, peer connection in state: ${pc.signalingState}`
              );
            }
          }
        } catch (error) {
          console.error("❌ Error handling WebRTC answer:", error);
        }
      }
    );

    // Handle ICE candidates
    socket.on(
      "webrtc-ice-candidate",
      async (data: { candidate: RTCIceCandidateInit; fromUserId: string }) => {
        console.log(`🧊 Received ICE candidate from ${data.fromUserId}`);

        try {
          const pc = peerConnections.current.get(data.fromUserId);
          if (pc) {
            console.log(
              `🔄 PC state: ${
                pc.signalingState
              }, remoteDesc: ${!!pc.remoteDescription}`
            );

            // Only add ICE candidates if we have a remote description and connection is stable
            if (
              pc.remoteDescription &&
              (pc.signalingState === "stable" ||
                pc.signalingState === "have-remote-offer")
            ) {
              console.log(`✅ Adding ICE candidate for ${data.fromUserId}`);
              await pc.addIceCandidate(data.candidate);
            } else {
              console.log(
                `⏳ Storing ICE candidate for later (state: ${pc.signalingState})`
              );
              // Store candidates for later
              const pending =
                pendingCandidates.current.get(data.fromUserId) || [];
              pending.push(data.candidate);
              pendingCandidates.current.set(data.fromUserId, pending);
            }
          } else {
            console.warn(`⚠️ No peer connection found for ${data.fromUserId}`);
          }
        } catch (error) {
          console.error("❌ Error handling ICE candidate:", error);
          // Don't let ICE candidate errors break the connection
        }
      }
    );

    // Handle user leaving video call
    socket.on("video-call-user-left", (data: { userId: string }) => {
      console.log(`👋 ${data.userId} left video call`);

      const pc = peerConnections.current.get(data.userId);
      if (pc) {
        pc.close();
        peerConnections.current.delete(data.userId);
      }

      setRemoteStreams((prev) => {
        const newMap = new Map(prev);
        newMap.delete(data.userId);
        return newMap;
      });
    });

    return () => {
      socket.off("video-call-user-joined");
      socket.off("webrtc-offer");
      socket.off("webrtc-answer");
      socket.off("webrtc-ice-candidate");
      socket.off("video-call-user-left");
    };
  }, [
    socketRef,
    currentUser.id,
    roomId,
    createPeerConnection,
    isVideoCallActive,
    localVideoStream,
  ]);

  // Handle Audio WebRTC signaling via Socket.IO (separate from video)
  useEffect(() => {
    if (!socketRef.current) return;

    const socket = socketRef.current;

    // Handle audio WebRTC offer
    socket.on(
      "audio-webrtc-offer",
      async (data: {
        offer: RTCSessionDescriptionInit;
        fromUserId: string;
      }) => {
        console.log(`🎤 Received audio offer from ${data.fromUserId}`);

        try {
          const pc = createAudioPeerConnection(data.fromUserId);
          if (!pc) {
            console.error(
              "❌ Failed to create audio peer connection for offer"
            );
            return;
          }

          console.log(
            `📥 Setting remote description for audio from ${data.fromUserId}`
          );
          await pc.setRemoteDescription(data.offer);

          // Add pending audio ICE candidates
          const pending =
            audioPendingCandidates.current.get(data.fromUserId) || [];
          for (const candidate of pending) {
            await pc.addIceCandidate(candidate);
            console.log(
              `🧊 Added pending audio ICE candidate for ${data.fromUserId}`
            );
          }
          audioPendingCandidates.current.delete(data.fromUserId);

          // Create answer
          console.log(`📞 Creating audio answer for ${data.fromUserId}`);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          // Send answer
          socket.emit("audio-webrtc-answer", {
            roomId,
            toUserId: data.fromUserId,
            answer,
          });
        } catch (error) {
          console.error("❌ Failed to handle audio offer:", error);
        }
      }
    );

    // Handle audio WebRTC answer
    socket.on(
      "audio-webrtc-answer",
      async (data: {
        answer: RTCSessionDescriptionInit;
        fromUserId: string;
      }) => {
        console.log(`🎤 Received audio answer from ${data.fromUserId}`);

        try {
          const pc = audioPeerConnections.current.get(data.fromUserId);
          if (pc) {
            console.log(`🔄 Audio PC state: ${pc.signalingState}`);

            // Only set remote description if we're in the correct state (have-local-offer)
            if (pc.signalingState === "have-local-offer") {
              console.log(
                `✅ Setting remote audio answer for ${data.fromUserId}`
              );
              await pc.setRemoteDescription(data.answer);

              // Add pending audio ICE candidates
              const pending =
                audioPendingCandidates.current.get(data.fromUserId) || [];
              for (const candidate of pending) {
                await pc.addIceCandidate(candidate);
                console.log(
                  `🧊 Added pending audio ICE candidate for ${data.fromUserId}`
                );
              }
              audioPendingCandidates.current.delete(data.fromUserId);
            } else {
              console.warn(
                `⚠️ Cannot set audio answer, PC state: ${pc.signalingState}`
              );
            }
          }
        } catch (error) {
          console.error("❌ Failed to handle audio answer:", error);
        }
      }
    );

    // Handle audio ICE candidates
    socket.on(
      "audio-webrtc-ice-candidate",
      async (data: { candidate: RTCIceCandidateInit; fromUserId: string }) => {
        console.log(`🧊 Received audio ICE candidate from ${data.fromUserId}`);

        try {
          const pc = audioPeerConnections.current.get(data.fromUserId);
          if (pc) {
            console.log(
              `🔄 Audio PC state: ${
                pc.signalingState
              }, remoteDesc: ${!!pc.remoteDescription}`
            );

            // Only add ICE candidates if we have a remote description and connection is stable
            if (
              pc.remoteDescription &&
              (pc.signalingState === "stable" ||
                pc.signalingState === "have-remote-offer")
            ) {
              await pc.addIceCandidate(data.candidate);
              console.log(
                `✅ Added audio ICE candidate for ${data.fromUserId}`
              );
            } else {
              // Store for later use
              if (!audioPendingCandidates.current.has(data.fromUserId)) {
                audioPendingCandidates.current.set(data.fromUserId, []);
              }
              audioPendingCandidates.current
                .get(data.fromUserId)!
                .push(data.candidate);
              console.log(
                `📦 Stored audio ICE candidate for later: ${data.fromUserId}`
              );
            }
          } else {
            console.warn(
              `⚠️ No audio peer connection found for ${data.fromUserId}`
            );
          }
        } catch (error) {
          console.error("❌ Failed to add audio ICE candidate:", error);
        }
      }
    );

    return () => {
      socket.off("audio-webrtc-offer");
      socket.off("audio-webrtc-answer");
      socket.off("audio-webrtc-ice-candidate");
    };
  }, [socketRef, currentUser.id, roomId, createAudioPeerConnection]);

  // Enhanced video toggle that works with WebRTC
  const toggleVideo = useCallback(() => {
    if (localVideoStream) {
      const videoTrack = localVideoStream.getVideoTracks()[0];
      if (videoTrack) {
        const newVideoState = !videoTrack.enabled;
        videoTrack.enabled = newVideoState;
        setIsVideoOn(newVideoState);

        // Notify other participants via socket
        if (socketRef.current) {
          socketRef.current.emit("participant-video-toggle", {
            roomId,
            userId: currentUser.id,
            isVideoOn: newVideoState,
          });
        }

        toast.info(newVideoState ? "Camera turned on" : "Camera turned off");
      }
    }
  }, [localVideoStream, roomId, currentUser.id, socketRef]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localVideoStream) {
        localVideoStream.getTracks().forEach((track) => track.stop());
      }
      peerConnections.current.forEach((pc) => pc.close());
      audioPeerConnections.current.forEach((pc) => pc.close());
    };
  }, [localVideoStream]);

  const canStartMeeting = realTimeParticipants.length >= 2;

  return (
    <div
      className="min-h-screen w-full bg-[#091717] overflow-x-hidden relative"
      onClick={tryPlayPendingAudio}
    >
      {/* Background Effects */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        {Array.from({ length: 40 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-[#20808D]/15 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -20, 0],
              opacity: [0, 0.8, 0],
              scale: [0, 1, 0],
            }}
            transition={{
              duration: Math.random() * 8 + 6,
              repeat: Infinity,
              delay: Math.random() * 4,
            }}
          />
        ))}
      </div>

      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div
            className="absolute inset-0"
            style={{
              background: `
              radial-gradient(circle at 25% 75%, rgba(32, 128, 141, 0.12) 0%, transparent 50%),
              radial-gradient(circle at 75% 25%, rgba(46, 86, 94, 0.12) 0%, transparent 50%)
            `,
            }}
          />
        </div>
      </div>

      {/* Meeting Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-20 p-4 bg-[#091717]/90 backdrop-blur-sm border-b border-[#20808D]/20"
      >
        <div className="flex items-center justify-between mx-auto max-w-7xl">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onLeaveRoom}
              className="text-white/70 hover:text-white hover:bg-[#20808D]/20"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Leave Meeting
            </Button>

            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-bold text-white">Meeting Room</h1>
              <Badge
                variant="outline"
                className={`${
                  isConnected
                    ? "bg-[#20808D]/20 text-[#20808D] border-[#20808D]/40"
                    : "bg-yellow-500/20 text-yellow-400 border-yellow-500/40"
                }`}
              >
                {isConnected ? "Connected" : "Connecting..."}
              </Badge>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowParticipants(!showParticipants)}
              className="text-white/70 hover:text-white hover:bg-[#20808D]/20"
            >
              <Users className="w-4 h-4 mr-2" />
              {realTimeParticipants.length}
            </Button>
            {/* <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className="text-white/70 hover:text-white hover:bg-[#20808D]/20"
            >
              <Settings className="w-4 h-4" />
            </Button> */}
            {/* <Button
              variant="ghost"
              size="sm"
              className="text-white/70 hover:text-white hover:bg-[#20808D]/20"
            >
              <MessageSquare className="w-4 h-4" />
            </Button> */}
          </div>
        </div>
      </motion.header>

      {/* Browser Compatibility Warning */}
      {!compatibility.isCompatible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-20 p-4 border-b bg-yellow-500/10 backdrop-blur-sm border-yellow-500/20"
        >
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="mb-1 font-semibold text-yellow-500">
                  Browser Compatibility Issues Detected
                </h3>
                <p className="text-sm text-yellow-400/80">
                  Some features may not work properly. Click &quot;Get
                  Help&quot; for troubleshooting steps.
                </p>
              </div>
            </div>
            <Button
              onClick={() => setShowTroubleshooting(true)}
              size="sm"
              className="font-medium text-black bg-yellow-500 hover:bg-yellow-600"
            >
              Get Help
            </Button>
          </div>
        </motion.div>
      )}

      {/* Mobile Instructions */}
      {compatibility.isMobile && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-20 p-4 border-b bg-blue-500/10 backdrop-blur-sm border-blue-500/20"
        >
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <div className="flex items-start space-x-3">
              <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0">
                <span className="text-xs font-bold text-white">📱</span>
              </div>
              <div>
                <h3 className="mb-1 font-semibold text-blue-400">
                  Mobile Device Detected
                </h3>
                <p className="text-sm text-blue-300/80">
                  Click &quot;Enable Microphone&quot; and select{" "}
                  <strong>&quot;Allow&quot;</strong> when Chrome prompts for
                  permission.
                </p>
              </div>
            </div>
            {!isStreaming && (
              <Button
                onClick={requestMobilePermission}
                size="sm"
                className="font-medium text-white bg-blue-500 hover:bg-blue-600 whitespace-nowrap"
              >
                Enable Microphone
              </Button>
            )}
          </div>
        </motion.div>
      )}

      {/* Main Content */}
      <div className="relative z-10 flex flex-1 h-[calc(100vh-140px)]">
        {/* Video Grid */}
        <div className="flex-1 p-6">
          {!canStartMeeting ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center justify-center h-full"
            >
              <Card className="bg-[#1a1a1a]/50 backdrop-blur-sm border-[#20808D]/20 p-8 text-center max-w-md">
                <CardContent className="space-y-6">
                  <motion.div
                    animate={{
                      scale: [1, 1.1, 1],
                      rotate: [0, 5, -5, 0],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="w-20 h-20 bg-gradient-to-br from-[#20808D] to-[#2E565E] rounded-full flex items-center justify-center mx-auto"
                  >
                    <Users className="w-10 h-10 text-white" />
                  </motion.div>
                  <div>
                    <h2 className="mb-2 text-2xl font-bold text-white">
                      Waiting for others to join
                    </h2>
                    <p className="mb-4 text-white/70">
                      At least 2 people are needed to start the meeting
                    </p>
                    <div className="space-y-2">
                      <Badge
                        variant="outline"
                        className="bg-[#20808D]/20 text-[#20808D] border-[#20808D]/40"
                      >
                        {realTimeParticipants.length} participant
                        {realTimeParticipants.length !== 1 ? "s" : ""} joined
                      </Badge>

                      {socketParticipants.length > 0 && (
                        <Badge
                          variant="outline"
                          className="ml-2 text-green-400 bg-green-500/20 border-green-500/40"
                        >
                          {socketParticipants.length} online
                        </Badge>
                      )}

                      {/* Debug info */}
                      <div className="text-xs text-white/50">
                        DB: {participants.length} | Socket:{" "}
                        {socketParticipants.length} | Total:{" "}
                        {realTimeParticipants.length}
                      </div>
                    </div>
                  </div>

                  {!isStreaming && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className="space-y-3"
                    >
                      {/* Test Microphone Button */}
                      <Button
                        onClick={requestMicrophonePermission}
                        variant="outline"
                        className="w-full border-[#20808D]/40 text-[#20808D] hover:bg-[#20808D]/10"
                      >
                        <Mic className="w-4 h-4 mr-2" />
                        Test Microphone Permission
                      </Button>

                      {/* Audio Toggle Button */}
                      <Button
                        onClick={async () => {
                          tryPlayPendingAudio();
                          if (isStreaming) {
                            await stopAudioStreaming();
                          } else {
                            await startAudioStreaming();
                          }
                        }}
                        className={`w-full ${
                          isStreaming
                            ? "bg-red-600 hover:bg-red-700"
                            : "bg-[#20808D] hover:bg-[#20808D]/90"
                        } text-white`}
                      >
                        <Mic className="w-4 h-4 mr-2" />
                        {isStreaming
                          ? "Stop Voice Communication"
                          : "Start Voice Communication"}
                      </Button>

                      {/* Show video call error if any */}
                      {videoCallError && (
                        <div className="p-3 text-sm text-red-400 border rounded-lg bg-red-500/10 border-red-500/20">
                          {videoCallError}
                        </div>
                      )}
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <div className="grid h-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {realTimeParticipants.map((participant, index) => {
                const status = participantStatus.get(participant.user_id);
                const isCurrentUser = participant.user_id === currentUser.id;
                // Use real-time speaking data from socket for all participants
                const isSpeaking = status?.isSpeaking || false;
                const participantStatus_fromSocket = participantStatus.get(
                  participant.user_id
                );

                return (
                  <motion.div
                    key={participant.id}
                    initial={{ opacity: 0, scale: 0.8, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="relative"
                  >
                    <Card
                      className={`bg-[#1a1a1a]/50 backdrop-blur-sm border-[#20808D]/20 overflow-hidden h-full transition-all duration-300 ${
                        isSpeaking
                          ? "ring-4 ring-green-400 ring-opacity-90 shadow-lg shadow-green-400/50 border-green-400/50"
                          : ""
                      }`}
                    >
                      <CardContent className="relative p-0 aspect-video">
                        {/* Video/Avatar Container */}
                        <div className="absolute inset-0 bg-gradient-to-br from-[#20808D]/20 to-[#2E565E]/20 flex items-center justify-center">
                          {/* Debug logging for video stream conditions */}
                          {(() => {
                            console.log(
                              `🔍 Video conditions for ${participant.profiles.full_name}:`,
                              {
                                isCurrentUser,
                                hasLocalStream: !!localVideoStream,
                                isVideoOn,
                                hasRemoteStream: remoteStreams.has(
                                  participant.user_id
                                ),
                                isVideoOff: status?.isVideoOff,
                                userId: participant.user_id,
                              }
                            );
                            return null;
                          })()}

                          {/* Video Stream or Avatar */}
                          {isCurrentUser && localVideoStream && isVideoOn ? (
                            <video
                              ref={localVideoRef}
                              autoPlay
                              playsInline
                              muted
                              className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                              onLoadedMetadata={() =>
                                console.log(
                                  "🎥 Local video element loaded metadata"
                                )
                              }
                              onError={(e) =>
                                console.error(
                                  "❌ Local video element error:",
                                  e
                                )
                              }
                            />
                          ) : remoteStreams.has(participant.user_id) &&
                            !status?.isVideoOff ? (
                            <video
                              autoPlay
                              playsInline
                              ref={(video) => {
                                if (
                                  video &&
                                  remoteStreams.has(participant.user_id)
                                ) {
                                  const stream = remoteStreams.get(
                                    participant.user_id
                                  )!;
                                  video.srcObject = stream;

                                  // Add debugging for remote video
                                  video.onloadedmetadata = () => {
                                    console.log(
                                      `✅ Remote video loaded for ${participant.user_id}`
                                    );
                                    video
                                      .play()
                                      .catch((e) =>
                                        console.error(
                                          "❌ Remote video play error:",
                                          e
                                        )
                                      );
                                  };

                                  video.onerror = (e) => {
                                    console.error(
                                      `❌ Remote video error for ${participant.user_id}:`,
                                      e
                                    );
                                  };

                                  console.log(
                                    `📺 Set remote video srcObject for ${participant.user_id}, stream active:`,
                                    stream.active
                                  );
                                }
                              }}
                              className="absolute inset-0 object-cover w-full h-full"
                            />
                          ) : (
                            <Avatar className="w-16 h-16">
                              <AvatarImage
                                src={participant.profiles.avatar_url}
                              />
                              <AvatarFallback className="bg-[#20808D] text-white text-xl font-bold">
                                {participant.profiles.full_name
                                  .charAt(0)
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          )}

                          {/* Speaking Indicator */}
                          {isSpeaking && (
                            <>
                              {/* Pulsing border */}
                              <motion.div
                                className="absolute inset-0 border-4 border-green-400 rounded-lg shadow-lg"
                                animate={{
                                  opacity: [0.4, 1, 0.4],
                                  scale: [1, 1.03, 1],
                                  borderWidth: ["4px", "6px", "4px"],
                                }}
                                transition={{
                                  duration: 0.8,
                                  repeat: Infinity,
                                  ease: "easeInOut",
                                }}
                              />

                              {/* Speaking icon */}
                              <motion.div
                                className="absolute p-1 bg-green-500 rounded-full top-2 left-2"
                                animate={{
                                  scale: [1, 1.2, 1],
                                  rotate: [0, 5, -5, 0],
                                }}
                                transition={{ duration: 0.6, repeat: Infinity }}
                              >
                                <Radio className="w-3 h-3 text-white" />
                              </motion.div>

                              {/* Background glow */}
                              <motion.div
                                className="absolute inset-0 rounded-lg bg-green-500/10"
                                animate={{ opacity: [0.2, 0.4, 0.2] }}
                                transition={{ duration: 1, repeat: Infinity }}
                              />
                            </>
                          )}

                          {/* Current User Audio Level Indicator */}
                          {isCurrentUser && audioLevel > 10 && !isSpeaking && (
                            <motion.div
                              className="absolute inset-0 border-4 border-[#20808D] rounded-lg"
                              animate={{ opacity: [0.3, 0.8, 0.3] }}
                              transition={{ duration: 0.5, repeat: Infinity }}
                            />
                          )}

                          {/* Hand Raised Indicator */}
                          {status?.isRaised && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute p-2 bg-yellow-500 rounded-full top-3 right-3"
                            >
                              <Hand className="w-4 h-4 text-white" />
                            </motion.div>
                          )}

                          {/* Role Badge */}
                          {participant.role === "host" && (
                            <div className="absolute top-3 left-3">
                              <Badge className="bg-[#20808D] text-white border-0">
                                <Crown className="w-3 h-3 mr-1" />
                                Host
                              </Badge>
                            </div>
                          )}
                        </div>

                        {/* Participant Info Overlay */}
                        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium text-white truncate">
                                {participant.profiles.full_name}
                                {isCurrentUser && " (You)"}
                              </span>
                              {isSpeaking && (
                                <motion.div
                                  animate={{ scale: [1, 1.2, 1] }}
                                  transition={{
                                    duration: 0.6,
                                    repeat: Infinity,
                                  }}
                                  className="flex items-center space-x-1"
                                >
                                  <Radio className="w-4 h-4 text-green-400" />
                                  <span className="text-xs font-semibold text-green-400">
                                    Speaking
                                  </span>
                                </motion.div>
                              )}
                            </div>
                            <div className="flex items-center space-x-1">
                              {/* Mute Status */}
                              {(isCurrentUser
                                ? isMuted
                                : participantStatus_fromSocket?.isMuted) && (
                                <div className="p-1 rounded bg-red-500/80">
                                  <MicOff className="w-3 h-3 text-white" />
                                </div>
                              )}

                              {/* Online Status for Socket participants */}
                              <div
                                className={`w-2 h-2 rounded-full ${
                                  socketParticipants.includes(
                                    participant.user_id
                                  )
                                    ? "bg-green-400"
                                    : "bg-gray-400"
                                }`}
                                title={
                                  socketParticipants.includes(
                                    participant.user_id
                                  )
                                    ? "Online"
                                    : "Offline"
                                }
                              />

                              {/* Audio Status */}
                              {socketParticipants.includes(
                                participant.user_id
                              ) &&
                                (status?.isMuted ? (
                                  <div className="p-1 rounded-full bg-red-500/80">
                                    <MicOff className="w-3 h-3 text-white" />
                                  </div>
                                ) : (
                                  <div className="p-1 bg-[#20808D]/80 rounded-full">
                                    <Mic className="w-3 h-3 text-white" />
                                  </div>
                                ))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Participants Panel */}
        <AnimatePresence>
          {showParticipants && (
            <motion.div
              initial={{ x: 320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 320, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-80 bg-[#1a1a1a]/50 backdrop-blur-sm border-l border-[#20808D]/20 p-4"
            >
              <Card className="bg-transparent border-0">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-white">
                    Participants ({realTimeParticipants.length})
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowParticipants(false)}
                      className="text-white/70 hover:text-white"
                    >
                      ×
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {realTimeParticipants.map((participant) => {
                    const status = participantStatus.get(participant.user_id);
                    const isCurrentUser =
                      participant.user_id === currentUser.id;
                    return (
                      <motion.div
                        key={participant.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center p-3 space-x-3 rounded-lg bg-[#20808D]/10 hover:bg-[#20808D]/20 transition-colors"
                      >
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={participant.profiles.avatar_url} />
                          <AvatarFallback className="bg-[#20808D] text-white">
                            {participant.profiles.full_name
                              .charAt(0)
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <p className="text-sm font-medium text-white truncate">
                              {participant.profiles.full_name}
                              {isCurrentUser && " (You)"}
                            </p>
                            {participant.role === "host" && (
                              <Crown className="w-3 h-3 text-[#20808D]" />
                            )}
                          </div>
                          <p className="text-xs text-white/60">
                            {participant.role === "host"
                              ? "Host"
                              : "Participant"}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          {status?.isRaised && (
                            <Hand className="w-4 h-4 text-yellow-400" />
                          )}
                          {status?.isMuted ? (
                            <MicOff className="w-4 h-4 text-red-400" />
                          ) : (
                            socketParticipants.includes(
                              participant.user_id
                            ) && <Mic className="w-4 h-4 text-[#20808D]" />
                          )}
                          <div
                            className={`w-2 h-2 rounded-full ${
                              socketParticipants.includes(participant.user_id)
                                ? "bg-[#20808D]"
                                : "bg-white/30"
                            }`}
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Controls */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-20 p-6 bg-[#091717]/90 backdrop-blur-sm border-t border-[#20808D]/20"
      >
        <div className="flex items-center justify-center max-w-4xl mx-auto">
          <div className="flex items-center space-x-4">
            {/* Mute Button */}
            <Button
              onClick={toggleMute}
              size="lg"
              className={`w-14 h-14 rounded-full border-2 transition-all duration-300 ${
                isMuted
                  ? "bg-red-500 hover:bg-red-600 border-red-400 text-white"
                  : "bg-[#20808D] hover:bg-[#20808D]/90 border-[#20808D] text-white"
              }`}
            >
              {isMuted ? (
                <MicOff className="w-6 h-6" />
              ) : (
                <Mic className="w-6 h-6" />
              )}
            </Button>

            {/* Start Audio Button (only shown when audio is not streaming) */}
            {!isStreaming && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 15 }}
              >
                <Button
                  onClick={async () => {
                    tryPlayPendingAudio();
                    if (isStreaming) {
                      await stopAudioStreaming();
                    } else {
                      await startAudioStreaming();
                    }
                  }}
                  size="lg"
                  className={`w-14 h-14 rounded-full border-2 text-white ${
                    isStreaming
                      ? "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 border-red-600"
                      : "bg-gradient-to-r from-[#20808D] to-[#2E565E] hover:from-[#20808D]/90 hover:to-[#2E565E]/90 border-[#20808D]"
                  }`}
                  title={
                    isStreaming
                      ? "Stop voice communication"
                      : compatibility.isMobile
                      ? "Tap to enable microphone (Allow permission when prompted)"
                      : "Start voice communication"
                  }
                >
                  <Mic className="w-6 h-6" />
                </Button>
              </motion.div>
            )}

            {/* Camera Toggle Button (only when video call is active) */}
            {/* {isVideoCallActive && (
              <Button
                onClick={toggleVideo}
                size="lg"
                className={`w-14 h-14 rounded-full border-2 transition-all duration-300 ${
                  !isVideoOn
                    ? "bg-red-500 hover:bg-red-600 border-red-400 text-white"
                    : "bg-[#20808D] hover:bg-[#20808D]/90 border-[#20808D] text-white"
                }`}
                title={isVideoOn ? "Turn off camera" : "Turn on camera"}
              >
                {isVideoOn ? (
                  <Video className="w-6 h-6" />
                ) : (
                  <VideoOff className="w-6 h-6" />
                )}
              </Button>
            )} */}

            {/* Single Video Call Toggle Button */}
            <Button
              onClick={isVideoCallActive ? stopVideoCall : startVideoCall}
              size="lg"
              className={`w-14 h-14 rounded-full border-2 transition-all duration-300 ${
                isVideoCallActive
                  ? "bg-red-500 hover:bg-red-600 border-red-400 text-white"
                  : "bg-green-500 hover:bg-green-600 border-green-400 text-white"
              }`}
              title={
                isVideoCallActive ? "Turn Off Video Call" : "Start Video Call"
              }
            >
              {isVideoCallActive ? (
                <VideoOff className="w-6 h-6" />
              ) : (
                <Video className="w-6 h-6" />
              )}
            </Button>

            {/* Hand Raise Button */}
            <Button
              onClick={handleHandRaise}
              size="lg"
              className={`w-14 h-14 rounded-full border-2 transition-all duration-300 ${
                handRaised
                  ? "bg-yellow-500 hover:bg-yellow-600 border-yellow-400 text-white"
                  : "bg-white/10 hover:bg-white/20 border-white/20 text-white"
              }`}
            >
              <Hand className={`w-6 h-6 ${handRaised ? "text-white" : ""}`} />
            </Button>

            {/* Test Speaking Button (for debugging) */}
            {/* <Button
              onClick={() => {
                console.log("🧪 Testing speaking indicator...");
                const newSpeakingState = !isSpeaking;
                setIsSpeaking(newSpeakingState);

                if (newSpeakingState) {
                  console.log("✅ Started test speaking");
                } else {
                  console.log("❌ Stopped test speaking");
                }

                if (socketRef.current) {
                  sendSpeakingStatus(newSpeakingState, 50);
                  console.log(`📡 Sent speaking status: ${newSpeakingState}`);
                }
              }}
              size="lg"
              className={`w-14 h-14 rounded-full border-2 transition-all duration-300 ${
                isSpeaking
                  ? "bg-green-500 hover:bg-green-600 border-green-400 text-white"
                  : "bg-white/10 hover:bg-white/20 border-white/20 text-white"
              }`}
              title="Test Speaking Indicator"
            >
              <Radio className="w-6 h-6" />
            </Button> */}

            {/* Audio Level Debug Button */}
            {/* <Button
              onClick={() => {
                console.log("🔍 Current audio state:");
                console.log("- Audio Level:", audioLevel);
                console.log("- Is Speaking:", isSpeaking);
                console.log("- Is Streaming:", isStreaming);
                console.log("- Is Muted:", isMuted);
                console.log("- Socket Connected:", isConnected);
                console.log(
                  "- Real-time Participants:",
                  realTimeParticipants.length
                );
                console.log(
                  "- Socket Participants:",
                  socketParticipants.length
                );
                console.log("- Database Participants:", participants.length);
                if (mediaStreamRef.current) {
                  const tracks = mediaStreamRef.current.getAudioTracks();
                  console.log("- Audio Tracks:", tracks.length);
                  if (tracks.length > 0) {
                    console.log("- Track Enabled:", tracks[0].enabled);
                    console.log("- Track Label:", tracks[0].label);
                  }
                }
                if (audioContextRef.current) {
                  console.log(
                    "- AudioContext State:",
                    audioContextRef.current.state
                  );
                }
              }}
              size="lg"
              className="text-white border-2 rounded-full w-14 h-14 bg-white/10 hover:bg-white/20 border-white/20"
              title="Debug Audio & Participant State"
            >
              🔍
            </Button> */}

            {/* Chat Button */}
            <Button
              onClick={() => setShowChat(!showChat)}
              size="lg"
              className={`w-14 h-14 rounded-full border-2 transition-all duration-300 relative ${
                showChat
                  ? "bg-[#20808D] hover:bg-[#20808D]/90 border-[#20808D] text-white"
                  : "bg-white/10 hover:bg-white/20 border-white/20 text-white"
              }`}
              title="Toggle Chat"
            >
              <MessageSquare className="w-6 h-6" />
              {unreadMessageCount > 0 && (
                <span className="absolute flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full -top-1 -right-1">
                  {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
                </span>
              )}
            </Button>

            {/* Screen Share Button */}
            <Button
              size="lg"
              className="text-white border-2 rounded-full w-14 h-14 bg-white/10 hover:bg-white/20 border-white/20"
            >
              <Monitor className="w-6 h-6" />
            </Button>

            {/* Leave Button */}
            <Button
              onClick={onLeaveRoom}
              size="lg"
              className="ml-8 text-white bg-red-500 border-2 border-red-400 rounded-full w-14 h-14 hover:bg-red-600"
            >
              <PhoneOff className="w-6 h-6" />
            </Button>
          </div>
        </div>

        {/* Meeting Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 text-center"
        >
          {canStartMeeting ? (
            <div className="space-y-2">
              {isStreaming ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-2 h-2 bg-[#20808D] rounded-full animate-pulse" />
                  <span className="text-sm text-[#20808D] font-medium">
                    Audio streaming active
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                  <span className="text-sm text-yellow-400">
                    Click the microphone button to start audio
                  </span>
                </div>
              )}

              {/* Video Call Status */}
              {isVideoCallActive && (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-sm font-medium text-green-400">
                    Video call active •{" "}
                    {remoteStreams.size + (localVideoStream ? 1 : 0)}{" "}
                    participants
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-white/50 animate-pulse" />
              <span className="text-sm text-white/70">
                Waiting for {2 - realTimeParticipants.length} more participant
                {2 - realTimeParticipants.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* Chat Panel */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            transition={{ type: "spring", damping: 20 }}
            className="fixed top-0 right-0 h-full w-80 bg-[#1a1a1a]/95 backdrop-blur-sm border-l border-[#20808D]/20 z-30"
          >
            <div className="flex flex-col h-full">
              {/* Chat Header */}
              <div className="flex items-center justify-between p-4 border-b border-[#20808D]/20">
                <h3 className="text-lg font-semibold text-white">
                  Meeting Chat
                </h3>
                <Button
                  onClick={() => setShowChat(false)}
                  variant="ghost"
                  size="sm"
                  className="text-white/60 hover:text-white"
                >
                  ×
                </Button>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                {chatMessages.length === 0 ? (
                  <div className="mt-8 text-center text-white/60">
                    <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No messages yet</p>
                    <p className="text-sm">Start the conversation!</p>
                  </div>
                ) : (
                  chatMessages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex flex-col space-y-1 ${
                        message.userId === currentUser.id
                          ? "items-end"
                          : "items-start"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-lg ${
                          message.userId === currentUser.id
                            ? "bg-[#20808D] text-white"
                            : "bg-white/10 text-white"
                        }`}
                      >
                        <p className="text-sm">{message.message}</p>
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-white/60">
                        <span>{message.userName}</span>
                        <span>•</span>
                        <span>
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              {/* Chat Input */}
              <div className="p-4 border-t border-[#20808D]/20">
                <div className="flex items-center space-x-2">
                  <Input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) =>
                      e.key === "Enter" && handleSendChatMessage()
                    }
                    placeholder="Type a message..."
                    className="flex-1 bg-white/10 border-white/20 text-white placeholder-white/60 focus:border-[#20808D]"
                  />
                  <Button
                    onClick={handleSendChatMessage}
                    size="sm"
                    disabled={!newMessage.trim()}
                    className="bg-[#20808D] hover:bg-[#20808D]/90 text-white"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Troubleshooting Modal */}
      <TroubleshootingModal
        isOpen={showTroubleshooting}
        onClose={() => setShowTroubleshooting(false)}
        compatibility={compatibility}
      />
    </div>
  );
}
