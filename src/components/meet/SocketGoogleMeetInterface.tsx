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
  const [audioLevel, setAudioLevel] = useState(0);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
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

    // Filter out participants who are no longer in socket participants
    const activeParticipants = updatedParticipants.filter((p) =>
      socketParticipants.includes(p.user_id)
    );

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

      setIsStreaming(true);
      updateAudioStatus(isMuted, true);
      console.log("🎙️ Audio streaming started");
      toast.success("Audio streaming activated");
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
  ]);

  // Auto-start audio streaming when minimum people present
  useEffect(() => {
    if (realTimeParticipants.length >= 2 && !isStreaming) {
      console.log(
        "🎤 Auto-starting audio streaming with",
        realTimeParticipants.length,
        "participants"
      );
      startAudioStreaming();
    }
  }, [realTimeParticipants.length, isStreaming, startAudioStreaming]);

  // Toggle mute
  const toggleMute = async () => {
    if (!isStreaming) {
      await startAudioStreaming();
      return;
    }

    const newMutedState = !isMuted;
    setIsMuted(newMutedState);

    // Control the actual audio track
    if (mediaStreamRef.current) {
      const audioTracks = mediaStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        audioTracks[0].enabled = !newMutedState;
        console.log(`🎤 Audio track ${newMutedState ? "muted" : "unmuted"}`);
      }
    }

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

  const canStartMeeting = realTimeParticipants.length >= 2;

  return (
    <div className="min-h-screen w-full bg-[#091717] overflow-x-hidden relative">
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className="text-white/70 hover:text-white hover:bg-[#20808D]/20"
            >
              <Settings className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-white/70 hover:text-white hover:bg-[#20808D]/20"
            >
              <MessageSquare className="w-4 h-4" />
            </Button>
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
                    <Badge
                      variant="outline"
                      className="bg-[#20808D]/20 text-[#20808D] border-[#20808D]/40"
                    >
                      {realTimeParticipants.length} participant
                      {realTimeParticipants.length !== 1 ? "s" : ""} joined
                      {socketParticipants.length > 0 && (
                        <span className="ml-2 text-green-400">
                          • {socketParticipants.length} online
                        </span>
                      )}
                    </Badge>
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

                      {/* Prepare Audio Button */}
                      <Button
                        onClick={startAudioStreaming}
                        className="w-full bg-[#20808D] hover:bg-[#20808D]/90 text-white"
                      >
                        <Mic className="w-4 h-4 mr-2" />
                        Prepare Audio
                      </Button>
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
                  onClick={startAudioStreaming}
                  size="lg"
                  className="w-14 h-14 bg-gradient-to-r from-[#20808D] to-[#2E565E] hover:from-[#20808D]/90 hover:to-[#2E565E]/90 rounded-full border-2 border-[#20808D] text-white"
                  title={
                    compatibility.isMobile
                      ? "Tap to enable microphone (Allow permission when prompted)"
                      : "Start Audio / Request Microphone Access"
                  }
                >
                  <Mic className="w-6 h-6" />
                </Button>
              </motion.div>
            )}

            {/* Video Button */}
            <Button
              onClick={() => setIsVideoOn(!isVideoOn)}
              size="lg"
              className={`w-14 h-14 rounded-full border-2 transition-all duration-300 ${
                !isVideoOn
                  ? "bg-red-500 hover:bg-red-600 border-red-400 text-white"
                  : "bg-[#20808D] hover:bg-[#20808D]/90 border-[#20808D] text-white"
              }`}
            >
              {isVideoOn ? (
                <Video className="w-6 h-6" />
              ) : (
                <VideoOff className="w-6 h-6" />
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
            <Button
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
            </Button>

            {/* Audio Level Debug Button */}
            <Button
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
            </Button>

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
            isStreaming ? (
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
            )
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
