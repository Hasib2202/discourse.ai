// src/components/debate/ParticipantsPanel.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X, Users, Crown, Mic, MicOff, Circle, Clock } from "lucide-react";
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

interface ParticipantsPanelProps {
  participants: Participant[];
  currentSpeakerId?: string;
  debateState: DebateState;
  onClose: () => void;
}

export default function ParticipantsPanel({
  participants,
  currentSpeakerId,
  debateState,
  onClose,
}: ParticipantsPanelProps) {
  const getRoleIcon = (role: string) => {
    switch (role) {
      case "host":
        return Crown;
      case "debater":
        return Mic;
      case "audience":
        return Users;
      default:
        return Users;
    }
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

  const getParticipantStatus = (participant: Participant) => {
    if (participant.user_id === currentSpeakerId) {
      return { status: "speaking", color: "#10B981", icon: Mic };
    }
    if (participant.status === "muted") {
      return { status: "muted", color: "#EF4444", icon: MicOff };
    }
    if (participant.is_online) {
      return { status: "online", color: "#10B981", icon: Circle };
    }
    return { status: "offline", color: "#6B7280", icon: Circle };
  };

  const getSpeakingOrder = () => {
    return debateState.speaking_order
      .map((userId) => participants.find((p) => p.user_id === userId))
      .filter(Boolean) as Participant[];
  };

  // Group participants by role
  const hosts = participants.filter((p) => p.role === "host");
  const debaters = participants.filter((p) => p.role === "debater");
  const audience = participants.filter((p) => p.role === "audience");

  return (
    <Card className="h-full border-0 bg-gradient-to-br from-[#13343B]/90 to-[#2E565E]/50 backdrop-blur-xl shadow-2xl">
      <CardHeader className="pb-4 border-b border-[#20808D]/20">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-3 text-white">
            <Users className="w-5 h-5 text-[#20808D]" />
            <span>Participants ({participants.length})</span>
          </CardTitle>

          <Button
            onClick={onClose}
            size="sm"
            variant="ghost"
            className="text-white/60 hover:text-white hover:bg-[#20808D]/20 rounded-full w-8 h-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 h-[calc(100%-80px)] overflow-y-auto space-y-6">
        {/* Current Speaker Highlight */}
        {currentSpeakerId && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 border rounded-xl bg-gradient-to-r from-green-500/20 to-green-400/10 border-green-500/30"
          >
            <h4 className="flex items-center mb-3 space-x-2 text-sm font-semibold text-green-400">
              <Mic className="w-4 h-4" />
              <span>Currently Speaking</span>
            </h4>

            {(() => {
              const speaker = participants.find(
                (p) => p.user_id === currentSpeakerId
              );
              if (!speaker) return null;

              const RoleIcon = getRoleIcon(speaker.role);

              return (
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={speaker.profiles.avatar_url} />
                      <AvatarFallback className="font-semibold text-green-400 bg-green-500/20">
                        {speaker.profiles.full_name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

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

                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-white">
                        {speaker.profiles.full_name}
                      </span>
                    </div>
                    <div className="flex items-center mt-1 space-x-2">
                      <Badge
                        style={{
                          backgroundColor: `${getRoleColor(speaker.role)}20`,
                          color: getRoleColor(speaker.role),
                          border: `1px solid ${getRoleColor(speaker.role)}40`,
                        }}
                        className="text-xs font-medium"
                      >
                        <RoleIcon className="w-3 h-3 mr-1" />
                        {speaker.role}
                      </Badge>
                      <Badge className="text-xs text-green-400 bg-green-500/20 border-green-500/40">
                        Speaking
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })()}
          </motion.div>
        )}

        {/* Speaking Order */}
        {debateState.speaking_order.length > 0 && (
          <div className="space-y-3">
            <h4 className="flex items-center space-x-2 text-sm font-semibold tracking-wide uppercase text-white/80">
              <Clock className="w-4 h-4 text-[#20808D]" />
              <span>Speaking Order</span>
            </h4>

            <div className="space-y-2">
              {getSpeakingOrder().map((participant, index) => {
                const isCurrent = participant.user_id === currentSpeakerId;
                const hasPassed =
                  debateState.speaking_order.indexOf(participant.user_id) <
                  debateState.speaking_order.indexOf(currentSpeakerId || "");
                const RoleIcon = getRoleIcon(participant.role);

                return (
                  <motion.div
                    key={participant.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`flex items-center space-x-3 p-3 rounded-lg border transition-all ${
                      isCurrent
                        ? "bg-green-500/20 border-green-500/50"
                        : hasPassed
                        ? "bg-[#20808D]/10 border-[#20808D]/20 opacity-60"
                        : "bg-[#091717]/40 border-[#20808D]/20"
                    }`}
                  >
                    <div className="flex items-center flex-shrink-0 space-x-2">
                      <div
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                          isCurrent
                            ? "border-green-500 bg-green-500 text-white"
                            : hasPassed
                            ? "border-[#20808D] bg-[#20808D] text-white"
                            : "border-[#20808D]/50 text-[#20808D]"
                        }`}
                      >
                        {index + 1}
                      </div>
                    </div>

                    <Avatar className="w-8 h-8">
                      <AvatarImage src={participant.profiles.avatar_url} />
                      <AvatarFallback className="bg-[#20808D]/20 text-[#20808D] font-semibold text-xs">
                        {participant.profiles.full_name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`font-medium truncate ${
                            isCurrent ? "text-green-400" : "text-white/90"
                          }`}
                        >
                          {participant.profiles.full_name}
                        </span>
                      </div>
                      <div className="flex items-center mt-1 space-x-1">
                        <RoleIcon
                          className="w-3 h-3"
                          style={{ color: getRoleColor(participant.role) }}
                        />
                        <span
                          className="text-xs"
                          style={{ color: getRoleColor(participant.role) }}
                        >
                          {participant.role}
                        </span>
                      </div>
                    </div>

                    {isCurrent && (
                      <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className="text-green-400"
                      >
                        <Mic className="w-4 h-4" />
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Host Section */}
        {hosts.length > 0 && (
          <div className="space-y-3">
            <h4 className="flex items-center space-x-2 text-sm font-semibold tracking-wide uppercase text-white/80">
              <Crown className="w-4 h-4 text-yellow-400" />
              <span>Host</span>
            </h4>

            <AnimatePresence>
              {hosts.map((participant) => {
                const status = getParticipantStatus(participant);
                const StatusIcon = status.icon;

                return (
                  <motion.div
                    key={participant.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex items-center space-x-3 p-3 rounded-lg bg-[#091717]/40 border border-yellow-400/20"
                  >
                    <div className="relative">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={participant.profiles.avatar_url} />
                        <AvatarFallback className="font-semibold text-yellow-400 bg-yellow-400/20">
                          {participant.profiles.full_name
                            .charAt(0)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div
                        className="absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 border-[#091717] rounded-full"
                        style={{ backgroundColor: status.color }}
                      />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-white">
                          {participant.profiles.full_name}
                        </span>
                      </div>
                      <div className="flex items-center mt-1 space-x-2">
                        <Badge className="text-xs font-medium text-yellow-400 bg-yellow-400/20 border-yellow-400/40">
                          <Crown className="w-3 h-3 mr-1" />
                          Host
                        </Badge>
                      </div>
                    </div>

                    <StatusIcon
                      className="w-4 h-4"
                      style={{ color: status.color }}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Debaters Section */}
        {debaters.length > 0 && (
          <div className="space-y-3">
            <h4 className="flex items-center space-x-2 text-sm font-semibold tracking-wide uppercase text-white/80">
              <Mic className="w-4 h-4 text-[#20808D]" />
              <span>Debaters ({debaters.length})</span>
            </h4>

            <AnimatePresence>
              {debaters.map((participant) => {
                const status = getParticipantStatus(participant);
                const RoleIcon = getRoleIcon(participant.role);
                const StatusIcon = status.icon;
                const isSpeaking = participant.user_id === currentSpeakerId;

                return (
                  <motion.div
                    key={participant.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className={`flex items-center space-x-3 p-3 rounded-lg border transition-all ${
                      isSpeaking
                        ? "bg-green-500/20 border-green-500/50"
                        : "bg-[#091717]/40 border-[#20808D]/20"
                    }`}
                  >
                    <div className="relative">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={participant.profiles.avatar_url} />
                        <AvatarFallback className="bg-[#20808D]/20 text-[#20808D] font-semibold">
                          {participant.profiles.full_name
                            .charAt(0)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      {isSpeaking ? (
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
                      ) : (
                        <div
                          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 border-[#091717] rounded-full"
                          style={{ backgroundColor: status.color }}
                        />
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`font-semibold ${
                            isSpeaking ? "text-green-400" : "text-white"
                          }`}
                        >
                          {participant.profiles.full_name}
                        </span>
                      </div>
                      <div className="flex items-center mt-1 space-x-2">
                        <Badge
                          style={{
                            backgroundColor: `${getRoleColor(
                              participant.role
                            )}20`,
                            color: getRoleColor(participant.role),
                            border: `1px solid ${getRoleColor(
                              participant.role
                            )}40`,
                          }}
                          className="text-xs font-medium"
                        >
                          <RoleIcon className="w-3 h-3 mr-1" />
                          Debater
                        </Badge>

                        {isSpeaking && (
                          <Badge className="text-xs text-green-400 bg-green-500/20 border-green-500/40">
                            Speaking
                          </Badge>
                        )}
                      </div>
                    </div>

                    <StatusIcon
                      className="w-4 h-4"
                      style={{ color: status.color }}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Audience Section */}
        {audience.length > 0 && (
          <div className="space-y-3">
            <h4 className="flex items-center space-x-2 text-sm font-semibold tracking-wide uppercase text-white/80">
              <Users className="w-4 h-4 text-gray-400" />
              <span>Audience ({audience.length})</span>
            </h4>

            <AnimatePresence>
              {audience.map((participant) => {
                const status = getParticipantStatus(participant);
                const RoleIcon = getRoleIcon(participant.role);
                const StatusIcon = status.icon;

                return (
                  <motion.div
                    key={participant.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex items-center space-x-3 p-3 rounded-lg bg-[#091717]/40 border border-gray-500/20"
                  >
                    <div className="relative">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={participant.profiles.avatar_url} />
                        <AvatarFallback className="text-xs font-semibold text-gray-400 bg-gray-500/20">
                          {participant.profiles.full_name
                            .charAt(0)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div
                        className="absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 border-[#091717] rounded-full"
                        style={{ backgroundColor: status.color }}
                      />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-white/90">
                          {participant.profiles.full_name}
                        </span>
                      </div>
                      <div className="flex items-center mt-1 space-x-2">
                        <Badge className="text-xs font-medium text-gray-400 bg-gray-500/20 border-gray-500/40">
                          <RoleIcon className="w-3 h-3 mr-1" />
                          Audience
                        </Badge>
                      </div>
                    </div>

                    <StatusIcon
                      className="w-3 h-3"
                      style={{ color: status.color }}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Empty State */}
        {participants.length === 0 && (
          <div className="py-8 text-center">
            <Users className="w-12 h-12 mx-auto mb-3 text-white/40" />
            <p className="text-white/60">No participants</p>
            <p className="text-sm text-white/40">
              Waiting for participants to join
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
