// src/components/meet/GoogleMeetInterface.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Settings,
  Users,
  Hand,
} from "lucide-react";
import { toast } from "sonner";

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

interface GoogleMeetInterfaceProps {
  roomId: string;
  currentUser: User;
  participants: Participant[];
  userDisplayName: string;
  onLeaveRoom: () => void;
}

interface AudioMessage {
  type: "audio" | "control" | "status";
  userId: string;
  data?: ArrayBuffer;
  action?: "mute" | "unmute" | "speaking" | "stopped" | "joined";
  timestamp: number;
}

export default function GoogleMeetInterface({
  roomId,
  currentUser,
  participants,
  userDisplayName,
  onLeaveRoom,
}: GoogleMeetInterfaceProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [connectedUsers, setConnectedUsers] = useState<string[]>([]);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [wsAvailable, setWsAvailable] = useState(true); // Track if WebSocket is available
  const [handRaised, setHandRaised] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize WebSocket connection for audio streaming
  const initializeWebSocket = useCallback(() => {
    // Don't attempt connection if WebSocket is determined to be unavailable
    if (!wsAvailable) {
      console.log(
        "📱 WebSocket marked as unavailable - skipping connection attempt"
      );
      return;
    }

    // Don't attempt connection if already connected or too many failed attempts
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      connectionAttempts >= 3
    ) {
      return;
    }

    try {
      // Clean up any existing connection
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      // Clear any pending reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      const wsUrl =
        process.env.NEXT_PUBLIC_AUDIO_WS_URL || `ws://localhost:8080`;
      console.log("🔗 Connecting to audio WebSocket:", wsUrl);

      wsRef.current = new WebSocket(wsUrl);
      wsRef.current.binaryType = "arraybuffer";

      wsRef.current.onopen = () => {
        console.log("🔗 WebSocket audio connection established");
        setIsConnected(true);
        setConnectionAttempts(0);

        const joinMessage: AudioMessage = {
          type: "status",
          userId: currentUser.id,
          action: "joined",
          timestamp: Date.now(),
        };
        wsRef.current?.send(JSON.stringify(joinMessage));
        toast.success("Connected to meeting");
      };

      wsRef.current.onmessage = async (event) => {
        if (typeof event.data === "string") {
          const message: AudioMessage = JSON.parse(event.data);
          handleControlMessage(message);
        } else {
          const audioData = event.data as ArrayBuffer;
          await playReceivedAudio(audioData);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log(
          "🔌 WebSocket audio connection closed",
          event.code,
          event.reason
        );
        setIsConnected(false);

        if (event.code === 1000) {
          console.log("✅ WebSocket closed normally");
        } else if (event.code === 1006) {
          console.log("⚠️ WebSocket closed abnormally, will retry...");
          if (connectionAttempts < 3) {
            setConnectionAttempts((prev) => prev + 1);
            reconnectTimeoutRef.current = setTimeout(() => {
              console.log(
                `🔄 Attempting reconnection (${connectionAttempts + 1}/3)...`
              );
              initializeWebSocket();
            }, 2000 * (connectionAttempts + 1));
          } else {
            console.log(
              "❌ Audio connection failed after 3 attempts - operating in offline mode"
            );
            setWsAvailable(false);
            toast.info(
              "Audio streaming not available - proceeding without real-time audio"
            );
          }
        } else {
          toast.info("Disconnected from meeting");
        }
      };

      wsRef.current.onerror = () => {
        console.log("⚠️ WebSocket connection failed - operating in local mode");
        setIsConnected(false);
        setWsAvailable(false);
        // Clear any pending reconnection attempts
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };
    } catch (error) {
      console.error("❌ Failed to initialize WebSocket:", error);
      console.log("📱 Proceeding without WebSocket audio streaming");
      // Don't show error toast immediately, let the app work without WebSocket
    }
  }, [currentUser.id, connectionAttempts, wsAvailable]);

  // Handle control messages from other participants
  const handleControlMessage = (message: AudioMessage) => {
    switch (message.action) {
      case "joined":
        setConnectedUsers((prev) => [
          ...prev.filter((id) => id !== message.userId),
          message.userId,
        ]);
        console.log(`👤 ${message.userId} joined meeting`);
        break;
      case "mute":
        console.log(`🔇 ${message.userId} muted`);
        break;
      case "unmute":
        console.log(`🔊 ${message.userId} unmuted`);
        break;
      case "speaking":
        console.log(`🎤 ${message.userId} started speaking`);
        break;
      case "stopped":
        console.log(`⏹️ ${message.userId} stopped speaking`);
        break;
    }
  };

  // Play received audio data from other participants
  const playReceivedAudio = async (audioData: ArrayBuffer) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      const audioBuffer = await audioContextRef.current.decodeAudioData(
        audioData.slice(0)
      );
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.start();
    } catch (error) {
      console.error("❌ Error playing received audio:", error);
    }
  };

  // Initialize microphone and audio capture
  const initializeMicrophone = useCallback(async () => {
    try {
      console.log("🎤 Requesting microphone access...");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
        },
      });

      mediaStreamRef.current = stream;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(
        1024,
        1,
        1
      );
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        if (
          !isMuted &&
          isStreaming &&
          wsRef.current?.readyState === WebSocket.OPEN
        ) {
          const inputBuffer = event.inputBuffer;
          const inputData = inputBuffer.getChannelData(0);

          let sum = 0;
          for (let i = 0; i < inputData.length; i++) {
            sum += inputData[i] * inputData[i];
          }
          const level = Math.sqrt(sum / inputData.length) * 100;
          setAudioLevel(level);

          const targetBuffer = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            targetBuffer[i] = Math.max(
              -32768,
              Math.min(32767, inputData[i] * 32767)
            );
          }

          wsRef.current?.send(targetBuffer.buffer);
        }
      };

      source.connect(processor);
      processor.connect(audioContextRef.current.destination);

      console.log("✅ Microphone initialized successfully");
      toast.success("Microphone connected");
    } catch (error) {
      console.error("❌ Failed to initialize microphone:", error);
      toast.error("Failed to access microphone. Please check permissions.");
    }
  }, [isMuted, isStreaming]);

  // Start audio streaming (works both with and without WebSocket)
  const startAudioStreaming = useCallback(async () => {
    // Always try to initialize microphone, even in Local Mode
    try {
      await initializeMicrophone();
      setIsStreaming(true);

      // If WebSocket is available, send control message
      if (
        wsAvailable &&
        isConnected &&
        wsRef.current?.readyState === WebSocket.OPEN
      ) {
        const message: AudioMessage = {
          type: "control",
          userId: currentUser.id,
          action: "speaking",
          timestamp: Date.now(),
        };
        wsRef.current.send(JSON.stringify(message));
        console.log("🎙️ Audio streaming started with WebSocket");
      } else {
        console.log("🎙️ Audio streaming started in Local Mode");
        toast.success("Microphone activated (Local Mode)");
      }
    } catch (error) {
      console.error("❌ Failed to start audio streaming:", error);
      toast.error("Failed to access microphone. Please check permissions.");
    }
  }, [wsAvailable, isConnected, currentUser.id, initializeMicrophone]);

  // Auto-start audio streaming when minimum people present (works in both WebSocket and Local modes)
  useEffect(() => {
    console.log(
      "👥 Participants changed:",
      participants.length,
      "participants"
    );
    console.log(
      "👤 Participant details:",
      participants.map((p) => ({
        name: p.profiles.full_name,
        role: p.role,
        userId: p.user_id,
        isCurrentUser: p.user_id === currentUser.id,
      }))
    );
    console.log("🎤 Current audio state:", {
      isStreaming,
      isMuted,
      wsAvailable,
      isConnected,
    });

    // Start audio when 2+ participants join, regardless of WebSocket connection status
    if (participants.length >= 2 && !isStreaming) {
      console.log(
        "🎤 Auto-starting audio streaming with",
        participants.length,
        "participants"
      );
      startAudioStreaming();
    }
  }, [
    participants.length,
    isStreaming,
    startAudioStreaming,
    isMuted,
    wsAvailable,
    participants,
    currentUser.id,
    isConnected,
  ]);

  // Stop audio streaming
  const stopAudioStreaming = () => {
    setIsStreaming(false);
    setAudioLevel(0);

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    const message: AudioMessage = {
      type: "control",
      userId: currentUser.id,
      action: "stopped",
      timestamp: Date.now(),
    };
    wsRef.current?.send(JSON.stringify(message));

    console.log("⏹️ Audio streaming stopped");
  };

  // Toggle mute
  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);

    const message: AudioMessage = {
      type: "control",
      userId: currentUser.id,
      action: newMutedState ? "mute" : "unmute",
      timestamp: Date.now(),
    };
    wsRef.current?.send(JSON.stringify(message));

    toast.info(newMutedState ? "Microphone muted" : "Microphone unmuted");
  };

  // Initialize WebSocket connection on component mount
  useEffect(() => {
    // Add a small delay to allow the component to mount properly
    const initTimeout = setTimeout(() => {
      initializeWebSocket();
    }, 1000); // 1 second delay

    return () => {
      clearTimeout(initTimeout);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [initializeWebSocket]);

  const canStartMeeting = participants.length >= 2;

  return (
    <div className="h-screen bg-[#1a1a1a] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-[#202124] border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <h1 className="text-xl font-medium text-white">Meeting Room</h1>
          <Badge
            variant="outline"
            className={`${
              isConnected
                ? "bg-green-500/20 text-green-400 border-green-500/40"
                : wsAvailable
                ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/40"
                : "bg-blue-500/20 text-blue-400 border-blue-500/40"
            }`}
          >
            {isConnected
              ? "Connected"
              : wsAvailable
              ? "Connecting..."
              : "Local Mode"}
          </Badge>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowParticipants(!showParticipants)}
            className="text-gray-300 hover:text-white hover:bg-gray-700"
          >
            <Users className="w-4 h-4 mr-2" />
            {participants.length}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
            className="text-gray-300 hover:text-white hover:bg-gray-700"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1">
        {/* Video Grid */}
        <div className="flex-1 p-6">
          {!canStartMeeting ? (
            <div className="flex items-center justify-center h-full">
              <div className="space-y-4 text-center">
                <div className="w-16 h-16 bg-[#34a853] rounded-full flex items-center justify-center mx-auto">
                  <Users className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-medium text-white">
                  Waiting for others to join
                </h2>
                <p className="text-gray-400">
                  At least 2 people are needed to start the meeting
                </p>
                <p className="text-sm text-gray-500">
                  Currently: {participants.length} participant
                  {participants.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          ) : (
            <div className="relative grid h-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Microphone Access Prompt */}
              {!isStreaming && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                  <div className="p-6 space-y-4 text-center rounded-lg bg-[#303134] border border-gray-600">
                    <div className="flex items-center justify-center w-16 h-16 mx-auto bg-yellow-500 rounded-full">
                      <Mic className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-medium text-white">
                      Allow Microphone Access
                    </h3>
                    <p className="text-gray-400">
                      Click the microphone button below to enable audio for this meeting
                    </p>
                    <Button
                      onClick={startAudioStreaming}
                      size="lg"
                      className="px-6 py-3 text-white bg-green-500 hover:bg-green-600"
                    >
                      <Mic className="w-5 h-5 mr-2" />
                      Enable Microphone
                    </Button>
                  </div>
                </div>
              )}
              
              {participants.map((participant) => (
                <motion.div
                  key={participant.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative bg-[#303134] rounded-lg overflow-hidden"
                >
                  {/* Participant Video/Avatar */}
                  <div className="aspect-video bg-[#1a1a1a] flex items-center justify-center relative">
                    <div className="w-16 h-16 bg-[#34a853] rounded-full flex items-center justify-center">
                      <span className="text-xl font-medium text-white">
                        {participant.profiles.full_name.charAt(0).toUpperCase()}
                      </span>
                    </div>

                    {/* Audio Level Indicator */}
                    {participant.user_id === currentUser.id &&
                      audioLevel > 10 && (
                        <motion.div
                          className="absolute inset-0 border-4 border-green-400 rounded-lg"
                          animate={{ opacity: [0.3, 0.8, 0.3] }}
                          transition={{ duration: 0.5, repeat: Infinity }}
                        />
                      )}
                  </div>

                  {/* Participant Info */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">
                        {participant.profiles.full_name}
                        {participant.user_id === currentUser.id && " (You)"}
                      </span>
                      <div className="flex items-center space-x-1">
                        {participant.user_id === currentUser.id && isMuted && (
                          <MicOff className="w-4 h-4 text-red-400" />
                        )}
                        {connectedUsers.includes(participant.user_id) && (
                          <div className="w-2 h-2 bg-green-400 rounded-full" />
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Participants Panel */}
        <AnimatePresence>
          {showParticipants && (
            <motion.div
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              className="w-80 bg-[#202124] border-l border-gray-700 p-4"
            >
              <h3 className="mb-4 text-lg font-medium text-white">
                Participants ({participants.length})
              </h3>
              <div className="space-y-2">
                {participants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center p-2 space-x-3 rounded-lg hover:bg-gray-700"
                  >
                    <div className="w-8 h-8 bg-[#34a853] rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-white">
                        {participant.profiles.full_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-white">
                        {participant.profiles.full_name}
                        {participant.user_id === currentUser.id && " (You)"}
                      </p>
                      <p className="text-xs text-gray-400">
                        {participant.role === "host" ? "Host" : "Participant"}
                      </p>
                    </div>
                    <div className="flex items-center space-x-1">
                      {connectedUsers.includes(participant.user_id) ? (
                        <div className="w-2 h-2 bg-green-400 rounded-full" />
                      ) : (
                        <div className="w-2 h-2 bg-gray-400 rounded-full" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Controls */}
      <div className="p-6 bg-[#202124] border-t border-gray-700">
        <div className="flex items-center justify-center space-x-4">
          {/* Mute Button */}
          <Button
            onClick={toggleMute}
            size="lg"
            className={`w-12 h-12 rounded-full ${
              isMuted
                ? "bg-red-500 hover:bg-red-600"
                : "bg-gray-600 hover:bg-gray-700"
            }`}
          >
            {isMuted ? (
              <MicOff className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </Button>

          {/* Start Audio Button (only shown when audio is not streaming) */}
          {!isStreaming && (
            <Button
              onClick={startAudioStreaming}
              size="lg"
              className="w-12 h-12 bg-green-500 rounded-full hover:bg-green-600 animate-pulse"
              title="Start Audio / Request Microphone Access"
            >
              <Mic className="w-5 h-5" />
            </Button>
          )}

          {/* Video Button */}
          <Button
            onClick={() => setIsVideoOn(!isVideoOn)}
            size="lg"
            className={`w-12 h-12 rounded-full ${
              !isVideoOn
                ? "bg-red-500 hover:bg-red-600"
                : "bg-gray-600 hover:bg-gray-700"
            }`}
          >
            {isVideoOn ? (
              <Video className="w-5 h-5" />
            ) : (
              <VideoOff className="w-5 h-5" />
            )}
          </Button>

          {/* Hand Raise Button */}
          <Button
            onClick={() => setHandRaised(!handRaised)}
            size="lg"
            className={`w-12 h-12 rounded-full ${
              handRaised
                ? "bg-yellow-500 hover:bg-yellow-600"
                : "bg-gray-600 hover:bg-gray-700"
            }`}
          >
            <Hand className={`w-5 h-5 ${handRaised ? "text-white" : ""}`} />
          </Button>

          {/* Leave Button */}
          <Button
            onClick={onLeaveRoom}
            size="lg"
            className="w-12 h-12 bg-red-500 rounded-full hover:bg-red-600"
          >
            <PhoneOff className="w-5 h-5" />
          </Button>
        </div>

        {/* Local Mode Info */}
        {!wsAvailable && (
          <div className="px-3 py-2 mt-3 border rounded-lg bg-blue-500/10 border-blue-500/20">
            <p className="text-xs text-center text-blue-400">
              ℹ️ Local Mode - Audio works locally, click microphone button to
              start
            </p>
          </div>
        )}

        {/* Meeting Info */}
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-400">
            {canStartMeeting ? (
              isStreaming ? (
                <span className="text-green-400">
                  🎤 Audio streaming active
                </span>
              ) : (
                <span className="text-yellow-400">
                  ⚠️ Click the microphone button to start audio
                </span>
              )
            ) : (
              `Waiting for ${2 - participants.length} more participant${
                2 - participants.length !== 1 ? "s" : ""
              }`
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
