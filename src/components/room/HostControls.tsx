// src/components/room/HostControls.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Crown,
  Play,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Settings,
  Loader2,
  UserCheck,
} from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

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
  is_private: boolean;
  debate_duration: number;
  turn_duration: number;
  rounds_count: number;
}

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

interface HostControlsProps {
  room: Room;
  participants: Participant[];
  onRoomUpdate: () => void;
  onParticipantsUpdate: () => void;
}

export default function HostControls({
  room,
  participants,
  onRoomUpdate,
}: Omit<HostControlsProps, "onParticipantsUpdate">) {
  const [loading, setLoading] = useState(false);

  const debaters = participants.filter((p) => p.role === "debater");
  const readyDebaters = debaters.filter((p) => p.ready_at);
  const readyParticipants = participants.filter((p) => p.ready_at);
  const totalParticipants = participants.length;

  const canStartMeeting = () => {
    // Minimum requirements to start meeting
    if (debaters.length < 2) return false;
    if (readyDebaters.length < debaters.length) return false;
    return true;
  };

  const getStartButtonText = () => {
    if (debaters.length < 2)
      return `Need ${2 - debaters.length} More Debaters`;
    if (readyDebaters.length < debaters.length)
      return `${debaters.length - readyDebaters.length} Debaters Not Ready`;
    return "Start Meeting";
  };

  const handleStartMeeting = async () => {
    if (!canStartMeeting()) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("rooms")
        .update({
          status: "active",
          started_at: new Date().toISOString(),
        })
        .eq("id", room.id);

      if (error) throw error;

      // Send system message
      await supabase.from("messages").insert({
        room_id: room.id,
        user_id: room.host_id,
        content: "The meeting has started!",
        message_type: "system",
      });

      toast.success("Meeting started!");
      onRoomUpdate();
    } catch (error) {
      console.error("Error starting meeting:", error);
      toast.error("Failed to start meeting");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-0 bg-gradient-to-br from-[#13343B]/80 to-[#2E565E]/40 backdrop-blur-xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2 text-lg text-white">
          <Crown className="w-5 h-5 text-yellow-400" />
          <span>Host Controls</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Meeting Requirements */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-white/80">
            Meeting Requirements
          </h4>

          <div className="space-y-2">
            {/* Minimum Participants Check */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#091717]/40 border border-[#20808D]/20">
              <div className="flex items-center space-x-2">
                {debaters.length >= 2 ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                )}
                <span className="text-sm text-white/90">
                  Minimum 2 Debaters
                </span>
              </div>
              <Badge
                className={`text-xs font-semibold ${
                  debaters.length >= 2
                    ? "bg-green-500/20 text-green-400 border-green-500/40"
                    : "bg-yellow-500/20 text-yellow-400 border-yellow-500/40"
                }`}
              >
                {debaters.length}/2
              </Badge>
            </div>

            {/* Participants Ready Check */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#091717]/40 border border-[#20808D]/20">
              <div className="flex items-center space-x-2">
                {readyDebaters.length === debaters.length &&
                debaters.length > 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                ) : (
                  <Clock className="w-4 h-4 text-yellow-400" />
                )}
                <span className="text-sm text-white/90">
                  All Debaters Ready
                </span>
              </div>
              <Badge
                className={`text-xs font-semibold ${
                  readyDebaters.length === debaters.length &&
                  debaters.length > 0
                    ? "bg-green-500/20 text-green-400 border-green-500/40"
                    : "bg-yellow-500/20 text-yellow-400 border-yellow-500/40"
                }`}
              >
                {readyDebaters.length}/{debaters.length}
              </Badge>
            </div>
          </div>
        </div>

        {/* Start Meeting Button */}
        <motion.div
          whileHover={canStartMeeting() ? { scale: 1.02 } : {}}
          whileTap={canStartMeeting() ? { scale: 0.98 } : {}}
        >
          <Button
            onClick={handleStartMeeting}
            disabled={!canStartMeeting() || loading}
            size="lg"
            className={`w-full h-12 font-semibold text-lg transition-all duration-300 ${
              canStartMeeting()
                ? "bg-green-500/20 hover:bg-green-500/30 text-green-400 border-green-500/40 shadow-lg shadow-green-500/20"
                : "bg-gray-500/20 text-gray-400 border-gray-500/40 cursor-not-allowed"
            } border backdrop-blur-sm`}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <Play className="w-5 h-5 mr-2" />
            )}
            {loading ? "Starting..." : getStartButtonText()}
          </Button>
        </motion.div>

        {/* Room Statistics */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-[#091717]/40 border border-[#20808D]/20 text-center">
            <Users className="w-4 h-4 text-[#20808D] mx-auto mb-1" />
            <div className="text-sm font-semibold text-white">
              {totalParticipants}
            </div>
            <div className="text-xs text-white/60">Total</div>
          </div>

          <div className="p-3 rounded-lg bg-[#091717]/40 border border-[#20808D]/20 text-center">
            <UserCheck className="w-4 h-4 mx-auto mb-1 text-green-400" />
            <div className="text-sm font-semibold text-white">
              {readyParticipants.length}
            </div>
            <div className="text-xs text-white/60">Ready</div>
          </div>

          <div className="p-3 rounded-lg bg-[#091717]/40 border border-[#20808D]/20 text-center">
            <Settings className="w-4 h-4 text-[#20808D] mx-auto mb-1" />
            <div className="text-sm font-semibold text-white">
              {debaters.length}
            </div>
            <div className="text-xs text-white/60">Debaters</div>
          </div>
        </div>

        {/* Helpful Tips */}
        <div className="p-3 rounded-lg bg-[#20808D]/10 border border-[#20808D]/20">
          <div className="flex items-start space-x-2">
            <Settings className="w-4 h-4 text-[#20808D] mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-[#20808D] text-sm font-semibold">Host Tips:</p>
              <ul className="space-y-1 text-xs text-white/70">
                <li>
                  • Ensure at least 2 participants have the
                  &quot;Debater&quot; role (you can join as a debater too)
                </li>
                <li>• All debaters must be ready before starting</li>
                <li>
                  • You can change participant roles from the participants list
                </li>
                <li>
                  • Once started, you&apos;ll be redirected to the Google
                  Meet-style interface
                </li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
