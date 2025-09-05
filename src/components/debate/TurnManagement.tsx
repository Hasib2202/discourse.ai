// src/components/debate/TurnManagement.tsx
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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

interface TurnManagementProps {
  participants: Participant[];
  debateState: DebateState;
  currentUser: User;
}

export default function TurnManagement({
  participants,
  debateState,
  currentUser,
}: TurnManagementProps) {
  const currentSpeaker = participants.find(
    (p) => p.user_id === debateState.current_speaker_id
  );

  const getCurrentSpeakerIndex = () => {
    return debateState.speaking_order.findIndex(
      (id) => id === debateState.current_speaker_id
    );
  };

  const getNextSpeaker = () => {
    const currentIndex = getCurrentSpeakerIndex();
    const nextIndex = (currentIndex + 1) % debateState.speaking_order.length;
    return participants.find(
      (p) => p.user_id === debateState.speaking_order[nextIndex]
    );
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "host":
        return "#FFD700";
      case "debater":
        return "#20808D";
      case "audience":
        return "#6B7280";
      default:
        return "#6B7280";
    }
  };

  const nextSpeaker = getNextSpeaker();
  const isCurrentUserSpeaking = currentSpeaker?.user_id === currentUser.id;

  return (
    <div className="flex items-center space-x-6">
      {/* Current Speaker */}
      <div className="flex items-center space-x-4">
        <div className="text-sm font-semibold text-white/70">
          Current Speaker:
        </div>

        <AnimatePresence mode="wait">
          {currentSpeaker ? (
            <motion.div
              key={currentSpeaker.id}
              initial={{ opacity: 0, scale: 0.8, x: -20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8, x: 20 }}
              transition={{ duration: 0.3 }}
              className={`flex items-center space-x-3 p-3 rounded-lg border transition-all ${
                isCurrentUserSpeaking
                  ? "bg-green-500/20 border-green-500/50 shadow-lg shadow-green-500/20"
                  : "bg-[#091717]/60 border-[#20808D]/30"
              }`}
            >
              <div className="relative">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={currentSpeaker.profiles.avatar_url} />
                  <AvatarFallback className="bg-[#20808D]/20 text-[#20808D] font-semibold">
                    {currentSpeaker.profiles.full_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                {/* Speaking Indicator */}
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.7, 1, 0.7],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-[#091717] flex items-center justify-center"
                >
                  <Mic className="w-2 h-2 text-white" />
                </motion.div>
              </div>

              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-white">
                    {currentSpeaker.profiles.full_name}
                    {isCurrentUserSpeaking && (
                      <span className="ml-2 text-sm text-green-400">(You)</span>
                    )}
                  </span>
                </div>

                <div className="flex items-center mt-1 space-x-2">
                  <Badge
                    style={{
                      backgroundColor: `${getRoleColor(currentSpeaker.role)}20`,
                      color: getRoleColor(currentSpeaker.role),
                      border: `1px solid ${getRoleColor(
                        currentSpeaker.role
                      )}40`,
                    }}
                    className="text-xs font-medium"
                  >
                    {currentSpeaker.role}
                  </Badge>

                  {isCurrentUserSpeaking && (
                    <Badge className="text-xs text-green-400 bg-green-500/20 border-green-500/40">
                      Your Turn
                    </Badge>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center space-x-3 p-3 rounded-lg bg-[#091717]/60 border border-[#20808D]/30"
            >
              <div className="w-10 h-10 rounded-full bg-[#20808D]/20 flex items-center justify-center">
                <MicOff className="w-5 h-5 text-[#20808D]" />
              </div>
              <div>
                <span className="text-white/70">No active speaker</span>
                <div className="text-xs text-white/50">
                  Waiting for next turn
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Separator */}
      <div className="w-px h-12 bg-[#20808D]/30"></div>

      {/* Next Speaker Preview */}
      <div className="flex items-center space-x-4">
        <div className="text-sm font-semibold text-white/70">Next Speaker:</div>

        <AnimatePresence mode="wait">
          {nextSpeaker ? (
            <motion.div
              key={nextSpeaker.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.3 }}
              className="flex items-center space-x-3 p-2 rounded-lg bg-[#091717]/40 border border-[#20808D]/20"
            >
              <Avatar className="w-8 h-8">
                <AvatarImage src={nextSpeaker.profiles.avatar_url} />
                <AvatarFallback className="bg-[#20808D]/20 text-[#20808D] font-semibold text-xs">
                  {nextSpeaker.profiles.full_name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div>
                <span className="text-sm font-medium text-white/90">
                  {nextSpeaker.profiles.full_name}
                  {nextSpeaker.user_id === currentUser.id && (
                    <span className="text-[#20808D] ml-2 text-xs">(You)</span>
                  )}
                </span>
                <div className="text-xs text-white/60">{nextSpeaker.role}</div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center space-x-2 text-white/50"
            >
              <div className="w-8 h-8 rounded-full bg-[#20808D]/10 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <span className="text-sm">End of round</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Speaking Order Progress */}
      <div className="flex items-center space-x-2">
        <span className="text-sm text-white/60">Turn:</span>
        <div className="flex space-x-1">
          {debateState.speaking_order.map((speakerId, index) => {
            const participant = participants.find(
              (p) => p.user_id === speakerId
            );
            const isCurrent = speakerId === debateState.current_speaker_id;
            const isPast = index < getCurrentSpeakerIndex();

            return (
              <motion.div
                key={speakerId}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  isCurrent
                    ? "bg-green-500 shadow-lg shadow-green-500/50"
                    : isPast
                    ? "bg-[#20808D]/50"
                    : "bg-[#20808D]/20"
                }`}
                animate={
                  isCurrent
                    ? {
                        scale: [1, 1.3, 1],
                        opacity: [0.7, 1, 0.7],
                      }
                    : {}
                }
                transition={
                  isCurrent
                    ? {
                        duration: 1.5,
                        repeat: Infinity,
                      }
                    : {}
                }
                title={participant?.profiles.full_name}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
