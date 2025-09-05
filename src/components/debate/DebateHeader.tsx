// src/components/debate/DebateHeader.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Users,
  MessageSquare,
  Crown,
  StopCircle,
  Volume2,
  VolumeX,
  Video,
  VideoOff,
} from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";

interface Room {
  id: string;
  title: string;
  topic: string;
  mode: "classic" | "corporate" | "interactive";
  status: "waiting" | "active" | "completed";
  current_participants: number;
  max_participants: number;
  host_id: string;
  room_code: string;
  created_at: string;
  started_at: string;
  is_private: boolean;
  debate_duration: number;
  turn_duration: number;
  rounds_count: number;
  profiles?: {
    full_name: string;
    avatar_url?: string;
  };
}

interface DebateHeaderProps {
  room: Room;
  isHost: boolean;
  onLeaveDebate: () => void;
  onEndDebate: () => void;
  onToggleParticipants: () => void;
  onToggleChat: () => void;
}

export default function DebateHeader({
  room,
  isHost,
  onLeaveDebate,
  onEndDebate,
  onToggleParticipants,
  onToggleChat,
}: DebateHeaderProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const getModeColor = (mode: string) => {
    switch (mode) {
      case "classic":
        return "#20808D";
      case "corporate":
        return "#2E565E";
      case "interactive":
        return "#20808D";
      default:
        return "#20808D";
    }
  };

  const getDebateDuration = () => {
    if (!room.started_at) return "00:00";

    const startTime = new Date(room.started_at).getTime();
    const currentTime = new Date().getTime();
    const duration = Math.floor((currentTime - startTime) / 1000);

    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;

    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <header className="relative z-10 border-b border-[#20808D]/30 bg-[#091717]/95 backdrop-blur-2xl shadow-xl shadow-[#20808D]/10">
      <div className="max-w-full px-6 py-4 mx-auto">
        <div className="flex items-center justify-between">
          {/* Left Side - Room Info */}
          <div className="flex items-center space-x-6">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link href={`/room/${room.id}`}>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-[#20808D]/50 text-white hover:bg-[#20808D]/20 backdrop-blur-sm"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Lobby
                </Button>
              </Link>
            </motion.div>

            <div className="flex items-center space-x-4">
              {/* Live Indicator */}
              <motion.div
                animate={{
                  scale: [1, 1.1, 1],
                  opacity: [0.7, 1, 0.7],
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="flex items-center px-3 py-1 space-x-2 border rounded-full bg-red-500/20 border-red-500/40"
              >
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-sm font-semibold text-red-400">LIVE</span>
              </motion.div>

              {/* Room Title & Mode */}
              <div>
                <motion.h1
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="flex items-center space-x-3 text-xl font-bold text-white"
                >
                  <span>{room.title}</span>
                  {isHost && (
                    <div title="You are the host">
                      <Crown className="w-4 h-4 text-yellow-400" />
                    </div>
                  )}
                </motion.h1>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="flex items-center space-x-2 text-white/70"
                >
                  <Badge
                    style={{
                      backgroundColor: `${getModeColor(room.mode)}25`,
                      color: getModeColor(room.mode),
                      border: `1px solid ${getModeColor(room.mode)}40`,
                    }}
                    className="text-xs font-semibold capitalize"
                  >
                    {room.mode}
                  </Badge>
                  <span>•</span>
                  <span className="text-sm">
                    Duration: {getDebateDuration()}
                  </span>
                </motion.div>
              </div>
            </div>
          </div>

          {/* Center - Media Controls */}
          <div className="flex items-center space-x-3">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMuted(!isMuted)}
                className={`border-[#20808D]/50 backdrop-blur-sm transition-colors ${
                  isMuted
                    ? "bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30"
                    : "text-white hover:bg-[#20808D]/20"
                }`}
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </Button>
            </motion.div>

            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsVideoOff(!isVideoOff)}
                className={`border-[#20808D]/50 backdrop-blur-sm transition-colors ${
                  isVideoOff
                    ? "bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30"
                    : "text-white hover:bg-[#20808D]/20"
                }`}
              >
                {isVideoOff ? (
                  <VideoOff className="w-4 h-4" />
                ) : (
                  <Video className="w-4 h-4" />
                )}
              </Button>
            </motion.div>
          </div>

          {/* Right Side - Panel Controls & Actions */}
          <div className="flex items-center space-x-3">
            {/* Panel Toggles */}
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="outline"
                size="sm"
                onClick={onToggleParticipants}
                className="border-[#20808D]/50 text-white hover:bg-[#20808D]/20 backdrop-blur-sm"
              >
                <Users className="w-4 h-4 mr-2" />
                <span className="hidden md:inline">Participants</span>
              </Button>
            </motion.div>

            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="outline"
                size="sm"
                onClick={onToggleChat}
                className="border-[#20808D]/50 text-white hover:bg-[#20808D]/20 backdrop-blur-sm"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                <span className="hidden md:inline">Chat</span>
              </Button>
            </motion.div>

            {/* Host Controls */}
            {isHost && (
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  onClick={onEndDebate}
                  variant="outline"
                  size="sm"
                  className="text-red-400 border-red-500/50 hover:bg-red-500/20 hover:border-red-500/70"
                >
                  <StopCircle className="w-4 h-4 mr-2" />
                  End Debate
                </Button>
              </motion.div>
            )}

            {/* Leave Debate Button */}
            {!isHost && (
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  onClick={onLeaveDebate}
                  variant="outline"
                  size="sm"
                  className="text-red-400 border-red-500/50 hover:bg-red-500/20 hover:border-red-500/70"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Leave
                </Button>
              </motion.div>
            )}
          </div>
        </div>

        {/* Topic Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-4 p-3 bg-gradient-to-r from-[#13343B]/60 to-[#2E565E]/60 rounded-lg border border-[#20808D]/20 backdrop-blur-sm"
        >
          <div className="mb-1 text-sm font-medium text-white/60">
            Debate Topic
          </div>
          <p className="leading-relaxed text-white">{room.topic}</p>
        </motion.div>
      </div>
    </header>
  );
}
