// src/components/debate/DebateTimer.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Clock, PlayCircle, PauseCircle, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";

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

interface DebateTimerProps {
  room: Room;
  debateState: DebateState;
  onTurnEnd: () => void;
}

export default function DebateTimer({
  room,
  debateState,
  onTurnEnd,
}: DebateTimerProps) {
  const [timeLeft, setTimeLeft] = useState(room.turn_duration);
  const [totalDebateTime, setTotalDebateTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  // Calculate time left in current turn
  const calculateTimeLeft = useCallback(() => {
    if (!debateState.turn_start_time) return room.turn_duration;

    const startTime = new Date(debateState.turn_start_time).getTime();
    const currentTime = new Date().getTime();
    const elapsed = Math.floor((currentTime - startTime) / 1000);
    const remaining = Math.max(0, room.turn_duration - elapsed);

    return remaining;
  }, [debateState.turn_start_time, room.turn_duration]);

  // Calculate total debate time
  const calculateTotalDebateTime = useCallback(() => {
    if (!room.started_at) return 0;

    const startTime = new Date(room.started_at).getTime();
    const currentTime = new Date().getTime();
    return Math.floor((currentTime - startTime) / 1000);
  }, [room.started_at]);

  // Timer effect
  useEffect(() => {
    const interval = setInterval(() => {
      if (debateState.current_speaker_id && debateState.turn_start_time) {
        const remaining = calculateTimeLeft();
        setTimeLeft(remaining);
        setIsRunning(remaining > 0);

        // Auto advance turn when time expires
        if (remaining <= 0 && hasStarted) {
          onTurnEnd();
        }
      }

      setTotalDebateTime(calculateTotalDebateTime());
    }, 1000);

    return () => clearInterval(interval);
  }, [
    debateState,
    calculateTimeLeft,
    calculateTotalDebateTime,
    onTurnEnd,
    hasStarted,
  ]);

  // Set hasStarted when debate begins
  useEffect(() => {
    if (debateState.current_speaker_id && debateState.turn_start_time) {
      setHasStarted(true);
    }
  }, [debateState.current_speaker_id, debateState.turn_start_time]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const getTimeColor = () => {
    const percentage = (timeLeft / room.turn_duration) * 100;
    if (percentage > 50) return "#20808D";
    if (percentage > 20) return "#F59E0B";
    return "#EF4444";
  };

  const progressPercentage = (timeLeft / room.turn_duration) * 100;
  const totalDebateProgressPercentage =
    (totalDebateTime / room.debate_duration) * 100;

  const getPhaseDisplay = () => {
    switch (debateState.phase) {
      case "opening":
        return "Opening Statements";
      case "rebuttal":
        return "Rebuttals";
      case "closing":
        return "Closing Arguments";
      case "completed":
        return "Debate Complete";
      default:
        return "Debate";
    }
  };

  return (
    <div className="flex items-center space-x-6">
      {/* Turn Timer */}
      <Card className="border-0 bg-gradient-to-r from-[#13343B]/60 to-[#2E565E]/60 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-[#20808D]" />
              <span className="text-sm font-semibold text-white/80">
                Turn Time
              </span>
            </div>

            <div className="flex items-center space-x-3">
              {/* Timer Display */}
              <motion.div
                animate={{
                  scale: timeLeft <= 10 && isRunning ? [1, 1.05, 1] : 1,
                  color: getTimeColor(),
                }}
                transition={{
                  duration: 0.5,
                  repeat: timeLeft <= 10 && isRunning ? Infinity : 0,
                }}
                className="font-mono text-2xl font-bold"
                style={{ color: getTimeColor() }}
              >
                {formatTime(timeLeft)}
              </motion.div>

              {/* Progress Bar */}
              <div className="w-24">
                <Progress
                  value={progressPercentage}
                  className="h-2 bg-[#091717]/60"
                />
              </div>

              {/* Status Indicator */}
              <div className="flex items-center space-x-2">
                {isRunning ? (
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    <PlayCircle className="w-4 h-4 text-green-400" />
                  </motion.div>
                ) : (
                  <PauseCircle className="w-4 h-4 text-white/50" />
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Phase & Round Info */}
      <Card className="border-0 bg-gradient-to-r from-[#13343B]/60 to-[#2E565E]/60 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <RotateCcw className="w-5 h-5 text-[#20808D]" />
              <span className="text-sm font-semibold text-white/80">Phase</span>
            </div>

            <div className="flex items-center space-x-3">
              <span className="font-semibold text-white">
                {getPhaseDisplay()}
              </span>
              <div className="w-px h-4 bg-[#20808D]/30"></div>
              <span className="text-white/70">
                Round {debateState.round_number}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Total Debate Time */}
      <Card className="border-0 bg-gradient-to-r from-[#13343B]/60 to-[#2E565E]/60 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-[#20808D]" />
              <span className="text-sm font-semibold text-white/80">
                Total Time
              </span>
            </div>

            <div className="flex items-center space-x-3">
              <div className="font-mono font-semibold text-white">
                {formatTime(totalDebateTime)}
              </div>

              <div className="w-20">
                <Progress
                  value={totalDebateProgressPercentage}
                  className="h-2 bg-[#091717]/60"
                />
              </div>

              <div className="text-sm text-white/60">
                / {formatTime(room.debate_duration)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warning Indicators */}
      {timeLeft <= 30 && isRunning && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center px-3 py-2 space-x-2 border rounded-lg bg-yellow-500/20 border-yellow-500/40"
        >
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          >
            <Clock className="w-4 h-4 text-yellow-400" />
          </motion.div>
          <span className="text-sm font-semibold text-yellow-400">
            30s Warning
          </span>
        </motion.div>
      )}

      {timeLeft <= 10 && isRunning && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center px-3 py-2 space-x-2 border rounded-lg bg-red-500/20 border-red-500/40"
        >
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              rotate: [0, 5, -5, 0],
            }}
            transition={{ duration: 0.3, repeat: Infinity }}
          >
            <Clock className="w-4 h-4 text-red-400" />
          </motion.div>
          <span className="text-sm font-bold text-red-400">TIME UP!</span>
        </motion.div>
      )}
    </div>
  );
}
