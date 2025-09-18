// src/components/room/RoomSettings.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Settings,
  Clock,
  MessageSquare,
  Users,
  Target,
  Timer,
  RotateCcw,
  Edit3,
  Save,
  X,
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

interface RoomSettingsProps {
  room: Room;
  isHost: boolean;
  onUpdate?: () => void;
}

export default function RoomSettings({
  room,
  isHost,
  onUpdate,
}: RoomSettingsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editData, setEditData] = useState({
    debate_duration: room.debate_duration,
    turn_duration: room.turn_duration,
    rounds_count: room.rounds_count,
    max_participants: room.max_participants,
  });

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case "classic":
        return MessageSquare;
      case "corporate":
        return Target;
      case "interactive":
        return Users;
      default:
        return MessageSquare;
    }
  };

  const getModeColor = (mode: string) => {
    switch (mode) {
      case "classic":
        return "#02BD9B";
      case "corporate":
        return "#02BD9B";
      case "interactive":
        return "#02BD9B";
      default:
        return "#02BD9B";
    }
  };

  const getModeDescription = (mode: string) => {
    switch (mode) {
      case "classic":
        return "Traditional structured debate format";
      case "corporate":
        return "Professional training and discussion";
      case "interactive":
        return "Open discussion with audience participation";
      default:
        return "Standard debate format";
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} min${minutes !== 1 ? "s" : ""}`;
  };

  const handleSave = async () => {
    if (!isHost) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("rooms")
        .update({
          debate_duration: editData.debate_duration,
          turn_duration: editData.turn_duration,
          rounds_count: editData.rounds_count,
          max_participants: editData.max_participants,
          updated_at: new Date().toISOString(),
        })
        .eq("id", room.id);

      if (error) throw error;

      toast.success("Room settings updated successfully!");
      setIsEditing(false);
      onUpdate?.();
    } catch (error) {
      console.error("Error updating room settings:", error);
      toast.error("Failed to update room settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditData({
      debate_duration: room.debate_duration,
      turn_duration: room.turn_duration,
      rounds_count: room.rounds_count,
      max_participants: room.max_participants,
    });
    setIsEditing(false);
  };

  const ModeIcon = getModeIcon(room.mode);

  return (
    <Card className="border-0 bg-gradient-to-br from-[#040404]/80 to-[#02BD9B]/40 backdrop-blur-xl">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2 text-lg text-white">
            <Settings className="w-5 h-5 text-[#02BD9B]" />
            <span>Room Settings</span>
          </CardTitle>

          {isHost && !isEditing && room.status === "waiting" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsEditing(true)}
              className="text-[#02BD9B] hover:bg-[#02BD9B]/20 hover:text-[#02BD9B]"
            >
              <Edit3 className="w-4 h-4 mr-2" />
              Edit
            </Button>
          )}

          {isEditing && (
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                className="bg-[#02BD9B] hover:bg-[#02BD9B]/90 text-[#040404] font-semibold"
              >
                <Save className="w-4 h-4 mr-1" />
                {isSaving ? "Saving..." : "Save"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancel}
                className="text-white/70 hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Debate Mode */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white/80">
              Debate Mode
            </span>
            <Badge
              style={{
                backgroundColor: `${getModeColor(room.mode)}25`,
                color: getModeColor(room.mode),
                border: `1px solid ${getModeColor(room.mode)}40`,
              }}
              className="text-xs font-semibold capitalize"
            >
              <ModeIcon className="w-3 h-3 mr-1" />
              {room.mode}
            </Badge>
          </div>

          <div className="p-3 rounded-lg bg-[#040404]/40 border border-[#02BD9B]/20">
            <p className="text-sm leading-relaxed text-white/70">
              {getModeDescription(room.mode)}
            </p>
          </div>
        </div>

        {/* Topic Display */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-white/80">Debate Topic</h4>
          <div className="p-4 rounded-lg bg-gradient-to-r from-[#02BD9B]/10 to-[#02BD9B]/10 border border-[#02BD9B]/20">
            <p className="leading-relaxed text-white">{room.topic}</p>
          </div>
        </div>

        {/* Time Settings */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-white/80">
            Time Configuration
          </h4>

          <div className="grid grid-cols-1 gap-3">
            {/* Total Duration */}
            <motion.div
              whileHover={{ scale: isEditing ? 1 : 1.02 }}
              className="flex items-center justify-between p-3 rounded-lg bg-[#040404]/40 border border-[#02BD9B]/20 hover:border-[#02BD9B]/40 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <Clock className="w-4 h-4 text-[#02BD9B]" />
                <span className="text-sm font-medium text-white/90">
                  Total Duration
                </span>
              </div>
              {isEditing ? (
                <div className="flex items-center space-x-2">
                  <Input
                    type="number"
                    value={editData.debate_duration / 60}
                    onChange={(e) =>
                      setEditData((prev) => ({
                        ...prev,
                        debate_duration: parseInt(e.target.value) * 60 || 1800,
                      }))
                    }
                    className="w-20 h-8 text-xs bg-[#040404]/60 border-[#02BD9B]/40 text-white"
                    min="5"
                    max="180"
                  />
                  <span className="text-xs text-white/60">min</span>
                </div>
              ) : (
                <Badge className="bg-[#02BD9B]/20 text-[#02BD9B] border-[#02BD9B]/40 font-semibold">
                  {formatDuration(room.debate_duration)}
                </Badge>
              )}
            </motion.div>

            {/* Turn Duration */}
            <motion.div
              whileHover={{ scale: isEditing ? 1 : 1.02 }}
              className="flex items-center justify-between p-3 rounded-lg bg-[#040404]/40 border border-[#02BD9B]/20 hover:border-[#02BD9B]/40 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <Timer className="w-4 h-4 text-[#02BD9B]" />
                <span className="text-sm font-medium text-white/90">
                  Turn Duration
                </span>
              </div>
              {isEditing ? (
                <div className="flex items-center space-x-2">
                  <Input
                    type="number"
                    value={editData.turn_duration / 60}
                    onChange={(e) =>
                      setEditData((prev) => ({
                        ...prev,
                        turn_duration: parseInt(e.target.value) * 60 || 120,
                      }))
                    }
                    className="w-20 h-8 text-xs bg-[#040404]/60 border-[#02BD9B]/40 text-white"
                    min="1"
                    max="10"
                  />
                  <span className="text-xs text-white/60">min</span>
                </div>
              ) : (
                <Badge className="bg-[#02BD9B]/20 text-[#02BD9B] border-[#02BD9B]/40 font-semibold">
                  {formatDuration(room.turn_duration)}
                </Badge>
              )}
            </motion.div>

            {/* Rounds Count */}
            <motion.div
              whileHover={{ scale: isEditing ? 1 : 1.02 }}
              className="flex items-center justify-between p-3 rounded-lg bg-[#040404]/40 border border-[#02BD9B]/20 hover:border-[#02BD9B]/40 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <RotateCcw className="w-4 h-4 text-[#02BD9B]" />
                <span className="text-sm font-medium text-white/90">
                  Rounds
                </span>
              </div>
              {isEditing ? (
                <Input
                  type="number"
                  value={editData.rounds_count}
                  onChange={(e) =>
                    setEditData((prev) => ({
                      ...prev,
                      rounds_count: parseInt(e.target.value) || 3,
                    }))
                  }
                  className="w-20 h-8 text-xs bg-[#040404]/60 border-[#02BD9B]/40 text-white"
                  min="1"
                  max="10"
                />
              ) : (
                <Badge className="bg-[#02BD9B]/20 text-[#02BD9B] border-[#02BD9B]/40 font-semibold">
                  {room.rounds_count}
                </Badge>
              )}
            </motion.div>
          </div>
        </div>

        {/* Room Info */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-white/80">
            Room Information
          </h4>

          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 rounded-lg bg-[#040404]/40">
              <span className="text-sm text-white/70">Visibility</span>
              <Badge
                className={`text-xs font-semibold ${
                  room.is_private
                    ? "bg-red-500/20 text-red-400 border-red-500/40"
                    : "bg-green-500/20 text-green-400 border-green-500/40"
                }`}
              >
                {room.is_private ? "Private" : "Public"}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-[#040404]/40">
              <span className="text-sm text-white/70">Max Participants</span>
              {isEditing ? (
                <Input
                  type="number"
                  value={editData.max_participants}
                  onChange={(e) =>
                    setEditData((prev) => ({
                      ...prev,
                      max_participants: parseInt(e.target.value) || 10,
                    }))
                  }
                  className="w-20 h-8 text-xs bg-[#040404]/60 border-[#02BD9B]/40 text-white"
                  min="2"
                  max="50"
                />
              ) : (
                <Badge className="bg-[#02BD9B]/20 text-[#02BD9B] border-[#02BD9B]/40 text-xs font-semibold">
                  {room.max_participants}
                </Badge>
              )}
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-[#040404]/40">
              <span className="text-sm text-white/70">Created</span>
              <span className="text-xs text-white/60">
                {new Date(room.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="p-3 border rounded-lg bg-gradient-to-r from-yellow-500/10 to-yellow-400/10 border-yellow-500/20">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-semibold text-yellow-400">
              {room.status === "waiting"
                ? "Waiting for host to start the debate"
                : room.status === "active"
                ? "Debate is in progress"
                : "Debate completed"}
            </span>
          </div>
        </div>

        {/* Host Notice */}
        {isHost && (
          <div className="p-3 border rounded-lg bg-gradient-to-r from-[#02BD9B]/10 to-[#02BD9B]/10 border-[#02BD9B]/20">
            <div className="flex items-center space-x-2">
              <Settings className="w-4 h-4 text-[#02BD9B]" />
              <span className="text-sm font-semibold text-[#02BD9B]">
                You can edit these settings while the room is in waiting status
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}