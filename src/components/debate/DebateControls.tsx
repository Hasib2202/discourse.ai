// src/components/debate/DebateControls.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  SkipForward,
  Square,
  Settings,
  Crown,
  AlertCircle,
  CheckCircle2,
  Clock,
  FastForward,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
}

interface DebateState {
  phase: "opening" | "rebuttal" | "closing" | "completed";
  current_speaker_id?: string;
  turn_start_time?: string;
  round_number: number;
  speaking_order: string[];
}

interface DebateControlsProps {
  room: Room;
  isHost: boolean;
  debateState: DebateState;
  onNextTurn: () => void;
  onEndDebate: () => void;
}

export default function DebateControls({
  room,
  isHost,
  debateState,
  onNextTurn,
  onEndDebate,
}: DebateControlsProps) {
  const [showControls, setShowControls] = useState(true);
  const [isAdvancing, setIsAdvancing] = useState(false);

  if (!isHost) return null;

  const handleNextTurn = async () => {
    setIsAdvancing(true);
    try {
      await onNextTurn();
    } finally {
      setIsAdvancing(false);
    }
  };

  const getPhaseProgress = () => {
    const phases = ["opening", "rebuttal", "closing", "completed"];
    const currentPhaseIndex = phases.indexOf(debateState.phase);
    return ((currentPhaseIndex + 1) / phases.length) * 100;
  };

  const canAdvanceTurn = () => {
    return (
      debateState.current_speaker_id && debateState.speaking_order.length > 0
    );
  };

  return (
    <div className="absolute inset-0 pointer-events-none">
      <AnimatePresence>
        {showControls && (
          <motion.div
            key="main-controls"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute z-30 transform -translate-x-1/2 bottom-6 left-1/2 pointer-events-auto"
          >
            <Card className="border-0 bg-gradient-to-r from-[#13343B]/90 to-[#2E565E]/90 backdrop-blur-xl shadow-2xl">
              <CardContent className="p-4">
                <div className="flex items-center space-x-4">
                  {/* Host Indicator */}
                  <div className="flex items-center space-x-2">
                    <Crown className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm font-semibold text-white/80">
                      Host Controls
                    </span>
                  </div>

                  <div className="w-px h-6 bg-[#20808D]/30"></div>

                  {/* Phase Info */}
                  <div className="flex items-center space-x-3">
                    <div className="text-center">
                      <div className="text-xs text-white/60">Current Phase</div>
                      <Badge className="bg-[#20808D]/20 text-[#20808D] border-[#20808D]/40 font-semibold text-xs">
                        {debateState.phase.charAt(0).toUpperCase() +
                          debateState.phase.slice(1)}
                      </Badge>
                    </div>

                    <div className="text-center">
                      <div className="text-xs text-white/60">Round</div>
                      <div className="font-semibold text-white">
                        {debateState.round_number}
                      </div>
                    </div>
                  </div>

                  <div className="w-px h-6 bg-[#20808D]/30"></div>

                  {/* Control Buttons */}
                  <div className="flex items-center space-x-2">
                    {/* Next Turn Button */}
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button
                        onClick={handleNextTurn}
                        disabled={!canAdvanceTurn() || isAdvancing}
                        size="sm"
                        className={`transition-all duration-200 ${
                          canAdvanceTurn()
                            ? "bg-[#20808D]/20 hover:bg-[#20808D]/30 text-[#20808D] border-[#20808D]/40"
                            : "bg-gray-500/20 text-gray-400 border-gray-500/40 cursor-not-allowed"
                        } border backdrop-blur-sm`}
                      >
                        {isAdvancing ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{
                              duration: 1,
                              repeat: Infinity,
                              ease: "linear",
                            }}
                            className="w-4 h-4 border-2 border-[#20808D] border-t-transparent rounded-full mr-2"
                          />
                        ) : (
                          <SkipForward className="w-4 h-4 mr-2" />
                        )}
                        Next Turn
                      </Button>
                    </motion.div>

                    {/* End Debate Button */}
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button
                        onClick={onEndDebate}
                        size="sm"
                        variant="outline"
                        className="text-red-400 border-red-500/50 hover:bg-red-500/20 hover:border-red-500/70 backdrop-blur-sm"
                      >
                        <Square className="w-4 h-4 mr-2" />
                        End Debate
                      </Button>
                    </motion.div>
                  </div>

                  <div className="w-px h-6 bg-[#20808D]/30"></div>

                  {/* Toggle Controls Visibility */}
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button
                      onClick={() => setShowControls(false)}
                      size="sm"
                      variant="ghost"
                      className="text-white/60 hover:text-white hover:bg-[#20808D]/20"
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                  </motion.div>
                </div>

                {/* Progress Indicators */}
                <div className="mt-3 pt-3 border-t border-[#20808D]/20">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/60">Debate Progress</span>
                    <span className="text-white/60">
                      {Math.round(getPhaseProgress())}% Complete
                    </span>
                  </div>

                  <div className="mt-2 h-1 bg-[#091717]/60 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${getPhaseProgress()}%` }}
                      transition={{ duration: 0.5 }}
                      className="h-full bg-gradient-to-r from-[#20808D] to-[#2E565E] rounded-full"
                    />
                  </div>
                </div>

                {/* Status Messages */}
                <div className="flex items-center mt-3 space-x-4">
                  {debateState.current_speaker_id ? (
                    <div className="flex items-center space-x-2 text-green-400">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-sm">Speaker active</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 text-yellow-400">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm">Waiting for next speaker</span>
                    </div>
                  )}

                  {debateState.round_number > room.rounds_count && (
                    <div className="flex items-center space-x-2 text-blue-400">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-sm">Final round active</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Show Controls Button (when hidden) */}
      {!showControls && (
        <motion.div
          key="show-controls-button"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute z-30 bottom-6 right-6 pointer-events-auto"
        >
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Button
              onClick={() => setShowControls(true)}
              size="sm"
              className="bg-[#20808D]/20 hover:bg-[#20808D]/30 text-[#20808D] border-[#20808D]/40 border backdrop-blur-sm rounded-full w-12 h-12 p-0"
            >
              <Crown className="w-5 h-5" />
            </Button>
          </motion.div>
        </motion.div>
      )}

      {/* Emergency Controls (Always visible in corner) */}
      <div className="absolute z-30 top-6 right-6 pointer-events-auto">
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            onClick={onEndDebate}
            size="sm"
            variant="outline"
            className="border-red-500/50 text-red-400 hover:bg-red-500/20 backdrop-blur-sm bg-[#091717]/80"
          >
            <Square className="w-4 h-4 mr-2" />
            Emergency End
          </Button>
        </motion.div>
      </div>

      {/* Quick Actions Floating Menu */}
      <div className="absolute z-30 bottom-6 right-6 pointer-events-auto">
        <div className="flex flex-col space-y-2">
          {/* Skip Current Turn (Emergency) */}
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={handleNextTurn}
              disabled={!canAdvanceTurn() || isAdvancing}
              size="sm"
              className="w-12 h-12 p-0 text-yellow-400 border rounded-full bg-yellow-500/20 hover:bg-yellow-500/30 border-yellow-500/40 backdrop-blur-sm"
              title="Force next turn"
            >
              <FastForward className="w-4 h-4" />
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
