// src/components/audio/WebSocketAudioStreaming.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Radio } from "lucide-react";
import { toast } from "sonner";

interface Participant {
  id: string;
  room_id: string;
  user_id: string;
  role: "host" | "debater" | "audience";
  status: "joined" | "ready" | "speaking" | "muted";
  joined_at: string;
  ready_at?: string;
  is_online: boolean;
  profiles: {
    full_name: string;
    avatar_url?: string;
  };
}

interface DebateState {
  phase: "opening" | "rebuttal" | "closing" | "completed";
  current_speaker_id?: string;
  turn_start_time?: string;
  round_number: number;
  speaking_order: string[];
}

interface User {
  id: string;
  email?: string;
}

interface WebSocketAudioStreamingProps {
  roomId: string;
  currentUser: User;
  participants: Participant[];
  debateState: DebateState;
  userDisplayName: string;
}

interface AudioMessage {
  type: "audio" | "control" | "status";
  userId: string;
  data?: ArrayBuffer;
  action?: "mute" | "unmute" | "speaking" | "stopped" | "joined";
  timestamp: number;
}

export default function WebSocketAudioStreaming({
  currentUser,
  participants,
  debateState,
  userDisplayName,
}: WebSocketAudioStreamingProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [connectedUsers, setConnectedUsers] = useState<string[]>([]);
  const [connectionAttempts, setConnectionAttempts] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize WebSocket connection for audio streaming
  const initializeWebSocket = useCallback(() => {
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

      // WebSocket server URL - can be configured via environment variable
      const wsUrl =
        process.env.NEXT_PUBLIC_AUDIO_WS_URL || `ws://localhost:8080`;
      console.log("🔗 Connecting to audio WebSocket:", wsUrl);

      wsRef.current = new WebSocket(wsUrl);
      wsRef.current.binaryType = "arraybuffer";

      wsRef.current.onopen = () => {
        console.log("🔗 WebSocket audio connection established");
        setIsConnected(true);
        setConnectionAttempts(0); // Reset attempts on successful connection

        // Send user join message
        const joinMessage: AudioMessage = {
          type: "status",
          userId: currentUser.id,
          action: "joined",
          timestamp: Date.now(),
        };
        wsRef.current?.send(JSON.stringify(joinMessage));
        toast.success("Connected to audio stream");
      };

      wsRef.current.onmessage = async (event) => {
        if (typeof event.data === "string") {
          // Handle control messages
          const message: AudioMessage = JSON.parse(event.data);
          handleControlMessage(message);
        } else {
          // Handle binary audio data
          const audioData = event.data as ArrayBuffer;
          // Play received audio data
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

        // Handle different close codes
        if (event.code === 1000) {
          // Normal closure
          console.log("✅ WebSocket closed normally");
        } else if (event.code === 1006) {
          // Abnormal closure - attempt reconnect
          console.log("⚠️ WebSocket closed abnormally, will retry...");
          if (connectionAttempts < 3) {
            setConnectionAttempts((prev) => prev + 1);
            reconnectTimeoutRef.current = setTimeout(() => {
              console.log(
                `🔄 Attempting reconnection (${connectionAttempts + 1}/3)...`
              );
              initializeWebSocket();
            }, 2000 * (connectionAttempts + 1)); // Exponential backoff
          } else {
            toast.error("Audio connection failed after 3 attempts");
          }
        } else {
          toast.info("Audio stream disconnected");
        }
      };

      wsRef.current.onerror = (error) => {
        console.error("❌ WebSocket audio error:", error);
        setIsConnected(false);
        // Don't show error toast immediately - let the close handler manage reconnection
      };
    } catch (error) {
      console.error("❌ Failed to initialize WebSocket:", error);
      toast.error("Failed to initialize audio streaming");
    }
  }, [currentUser.id, connectionAttempts]);

  // Handle control messages from other participants
  const handleControlMessage = (message: AudioMessage) => {
    switch (message.action) {
      case "joined":
        setConnectedUsers((prev) => [
          ...prev.filter((id) => id !== message.userId),
          message.userId,
        ]);
        console.log(`👤 ${message.userId} joined audio stream`);
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
  const initializeMicrophone = async () => {
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

      // Create audio context and processor
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

          // Calculate audio level for visualization
          let sum = 0;
          for (let i = 0; i < inputData.length; i++) {
            sum += inputData[i] * inputData[i];
          }
          const level = Math.sqrt(sum / inputData.length) * 100;
          setAudioLevel(level);

          // Convert to Int16 for transmission
          const targetBuffer = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            targetBuffer[i] = Math.max(
              -32768,
              Math.min(32767, inputData[i] * 32767)
            );
          }

          // Send audio data via WebSocket
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
  };

  // Start audio streaming
  const startAudioStreaming = async () => {
    if (!isConnected) {
      toast.error("Not connected to audio stream");
      return;
    }

    try {
      await initializeMicrophone();
      setIsStreaming(true);

      // Send control message
      const message: AudioMessage = {
        type: "control",
        userId: currentUser.id,
        action: "speaking",
        timestamp: Date.now(),
      };
      wsRef.current?.send(JSON.stringify(message));

      console.log("🎙️ Audio streaming started");
      toast.success("Audio streaming started");
    } catch (error) {
      console.error("❌ Failed to start audio streaming:", error);
      toast.error("Failed to start audio streaming");
    }
  };

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

    // Send control message
    const message: AudioMessage = {
      type: "control",
      userId: currentUser.id,
      action: "stopped",
      timestamp: Date.now(),
    };
    wsRef.current?.send(JSON.stringify(message));

    console.log("⏹️ Audio streaming stopped");
    toast.info("Audio streaming stopped");
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
    initializeWebSocket();

    return () => {
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

  const getCurrentSpeaker = () => {
    return participants.find(
      (p) => p.user_id === debateState.current_speaker_id
    );
  };

  const isCurrentUserSpeaking = () => {
    return debateState.current_speaker_id === currentUser.id;
  };

  return (
    <div className="relative w-full h-full bg-gradient-to-br from-[#091717] via-[#0D1F1F] to-[#13343B] rounded-lg overflow-hidden">
      {/* Connection Status */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute top-4 left-4 z-20"
      >
        <div className="bg-[#091717]/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-[#20808D]/30">
          <div className="flex items-center space-x-3">
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
              }`}
            ></div>
            <span className="text-sm font-semibold text-white/90">
              {isConnected ? "Audio Connected" : "Connecting..."}
            </span>
            <Badge className="bg-[#20808D]/20 text-[#20808D] border-[#20808D]/40 text-xs">
              {connectedUsers.length} Users
            </Badge>
          </div>
        </div>
      </motion.div>

      {/* Current Speaker Indicator */}
      {debateState.current_speaker_id && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute top-4 right-4 z-20"
        >
          <div className="px-4 py-2 border rounded-lg bg-green-500/20 backdrop-blur-sm border-green-500/40">
            <div className="flex items-center space-x-2">
              <Radio className="w-4 h-4 text-green-400 animate-pulse" />
              <span className="text-sm font-semibold text-green-400">
                {getCurrentSpeaker()?.profiles.full_name} Speaking
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Main Audio Interface */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center space-y-6">
          {/* Audio Level Visualization */}
          <motion.div
            className="relative mx-auto"
            style={{ width: 200, height: 200 }}
          >
            <div className="absolute inset-0 rounded-full border-4 border-[#20808D]/30">
              {/* Audio level ring */}
              <motion.div
                className="absolute inset-0 rounded-full border-4 border-[#20808D]"
                style={{
                  clipPath: `polygon(50% 50%, 50% 0%, ${
                    50 + audioLevel / 2
                  }% 0%, ${50 + audioLevel / 2}% 100%, 50% 100%)`,
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              />
            </div>

            {/* Center content */}
            <div className="absolute inset-4 bg-[#091717]/80 rounded-full flex items-center justify-center">
              <div className="text-center">
                <motion.div
                  animate={{ scale: audioLevel > 10 ? 1.1 : 1 }}
                  transition={{ duration: 0.1 }}
                >
                  {isMuted ? (
                    <MicOff className="w-8 h-8 text-red-400 mx-auto mb-2" />
                  ) : (
                    <Mic className="w-8 h-8 text-[#20808D] mx-auto mb-2" />
                  )}
                </motion.div>
                <div className="text-xs text-white/60">
                  {isCurrentUserSpeaking() ? "Your Turn" : "Listening"}
                </div>
              </div>
            </div>
          </motion.div>

          {/* User Info */}
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-white">
              {userDisplayName}
            </h3>
            <p className="text-sm text-white/60">
              {isStreaming ? "Streaming audio" : "Ready to stream"}
            </p>
          </div>

          {/* Audio Controls */}
          <div className="flex items-center justify-center space-x-4">
            <Button
              onClick={toggleMute}
              variant="outline"
              size="sm"
              className={`${
                isMuted
                  ? "border-red-500/50 text-red-400 hover:bg-red-500/20"
                  : "border-[#20808D]/50 text-[#20808D] hover:bg-[#20808D]/20"
              } backdrop-blur-sm`}
            >
              {isMuted ? (
                <MicOff className="w-4 h-4 mr-2" />
              ) : (
                <Mic className="w-4 h-4 mr-2" />
              )}
              {isMuted ? "Unmute" : "Mute"}
            </Button>

            {isCurrentUserSpeaking() && (
              <Button
                onClick={isStreaming ? stopAudioStreaming : startAudioStreaming}
                className={`${
                  isStreaming
                    ? "bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/40"
                    : "bg-[#20808D]/20 hover:bg-[#20808D]/30 text-[#20808D] border-[#20808D]/40"
                } border backdrop-blur-sm`}
              >
                {isStreaming ? (
                  <>
                    <Radio className="w-4 h-4 mr-2 animate-pulse" />
                    Stop Streaming
                  </>
                ) : (
                  <>
                    <Radio className="w-4 h-4 mr-2" />
                    Start Streaming
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Status Messages */}
          <div className="space-y-2">
            {!isConnected && (
              <p className="text-sm text-yellow-400">
                Connecting to audio stream...
              </p>
            )}
            {isConnected && !isCurrentUserSpeaking() && (
              <p className="text-sm text-white/60">
                Listening to{" "}
                {getCurrentSpeaker()?.profiles.full_name ||
                  "other participants"}
              </p>
            )}
            {isCurrentUserSpeaking() && !isStreaming && (
              <p className="text-sm text-[#20808D]">
                It&apos;s your turn to speak! Click &quot;Start Streaming&quot;
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Participants List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute bottom-4 left-4 z-20"
      >
        <div className="bg-[#091717]/90 backdrop-blur-sm rounded-lg p-3 border border-[#20808D]/30 max-w-xs">
          <h4 className="text-sm font-semibold text-white mb-2">
            Participants
          </h4>
          <div className="space-y-1">
            {participants.map((participant) => (
              <div
                key={participant.id}
                className="flex items-center space-x-2 text-xs"
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    connectedUsers.includes(participant.user_id)
                      ? "bg-green-500"
                      : "bg-gray-500"
                  }`}
                ></div>
                <span className="text-white/70 truncate">
                  {participant.profiles.full_name}
                  {participant.user_id === currentUser.id && " (You)"}
                </span>
                {participant.user_id === debateState.current_speaker_id && (
                  <Mic className="w-3 h-3 text-[#20808D]" />
                )}
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
