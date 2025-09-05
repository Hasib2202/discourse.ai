// src/app/room/[id]/debate/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

import DebateHeader from "@/components/debate/DebateHeader";
import WebSocketAudioStreaming from "@/components/audio/WebSocketAudioStreaming";
import DebateControls from "@/components/debate/DebateControls";
import TurnManagement from "@/components/debate/TurnManagement";
import DebateTimer from "@/components/debate/DebateTimer";
import ParticipantsPanel from "@/components/debate/ParticipantsPanel";
import DebateChat from "@/components/debate/DebateChat";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import AudioDebugPanel from "@/components/debug/AudioDebugPanel";

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

export default function DebateRoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [debateState, setDebateState] = useState<DebateState>({
    phase: "opening",
    round_number: 1,
    speaking_order: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isHost, setIsHost] = useState(false);
  const [currentParticipant, setCurrentParticipant] =
    useState<Participant | null>(null);
  const [showParticipantsPanel, setShowParticipantsPanel] = useState(false);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [showAudioDebug, setShowAudioDebug] = useState(false);

  // Check if user is authorized and room is active
  const checkAccess = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        router.push("/login");
        return;
      }
      setUser(currentUser);

      // Check if user is participant in this room
      const { data: participant } = await supabase
        .from("participants")
        .select("*")
        .eq("room_id", roomId)
        .eq("user_id", currentUser.id)
        .single();

      if (!participant) {
        toast.error("You are not a participant in this debate");
        router.push("/dashboard");
        return;
      }
    } catch (error) {
      console.error("Error checking access:", error);
      router.push("/dashboard");
    }
  }, [roomId, router]);

  const loadRoom = useCallback(async () => {
    try {
      // First get the room data
      const { data: roomData, error: roomError } = await supabase
        .from("rooms")
        .select("*")
        .eq("id", roomId)
        .single();

      if (roomError) {
        console.error("Error loading room:", roomError);
        toast.error("Failed to load debate room");
        router.push("/dashboard");
        return;
      }

      if (!roomData) {
        toast.error("Debate room not found");
        router.push("/dashboard");
        return;
      }

      if (roomData.status !== "active") {
        toast.error("This debate is not active");
        router.push(`/room/${roomId}`);
        return;
      }

      // Then get the host profile data
      let hostProfile = null;
      if (roomData.host_id) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name, avatar_url")
          .eq("id", roomData.host_id)
          .single();

        hostProfile = profileData;
      }

      // Combine the data
      const roomWithProfile = {
        ...roomData,
        profiles: hostProfile,
      };

      setRoom(roomWithProfile);
    } catch (error) {
      console.error("Error loading room:", error);
      router.push("/dashboard");
    }
  }, [roomId, router]);

  const loadParticipants = useCallback(async () => {
    try {
      // First get participants data
      const { data: participantsData, error: participantsError } =
        await supabase
          .from("participants")
          .select("*")
          .eq("room_id", roomId)
          .order("joined_at", { ascending: true });

      if (participantsError) {
        console.error("Error loading participants:", participantsError);
        return;
      }

      if (!participantsData) {
        setParticipants([]);
        return;
      }

      // Get all unique user IDs
      const userIds = participantsData.map((p) => p.user_id);

      // Get profiles for all participants
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);

      // Combine participants with their profiles
      const participantsWithProfiles = participantsData.map((participant) => {
        const profile = profilesData?.find((p) => p.id === participant.user_id);
        return {
          ...participant,
          profiles: profile || {
            full_name: "Unknown User",
            avatar_url: null,
          },
        };
      });

      setParticipants(participantsWithProfiles);
    } catch (error) {
      console.error("Error loading participants:", error);
    }
  }, [roomId]);

  // Initialize debate state and speaking order
  const initializeDebate = useCallback(() => {
    if (!participants.length) return;

    const debaters = participants.filter((p) => p.role === "debater");
    const speakingOrder = debaters.map((d) => d.user_id);

    setDebateState((prev) => ({
      ...prev,
      speaking_order: speakingOrder,
      current_speaker_id: speakingOrder[0] || undefined,
    }));
  }, [participants]);

  // Real-time subscriptions
  const setupSubscriptions = useCallback(() => {
    // Participants subscription
    const participantsSubscription = supabase
      .channel(`debate_${roomId}_participants`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participants",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          loadParticipants();
        }
      )
      .subscribe();

    // Room updates subscription
    const roomSubscription = supabase
      .channel(`debate_${roomId}_updates`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.new.status === "completed") {
            toast.success("Debate has ended");
            router.push(`/room/${roomId}`);
          } else {
            loadRoom();
          }
        }
      )
      .subscribe();

    // Debate state subscription (custom channel for turn management)
    const debateStateSubscription = supabase
      .channel(`debate_${roomId}_state`)
      .on("broadcast", { event: "state_change" }, (payload) => {
        setDebateState(payload.payload as DebateState);
      })
      .subscribe();

    return () => {
      participantsSubscription.unsubscribe();
      roomSubscription.unsubscribe();
      debateStateSubscription.unsubscribe();
    };
  }, [roomId, router, loadParticipants, loadRoom]);

  const initializeRoom = useCallback(async () => {
    setIsLoading(true);

    await checkAccess();
    await loadRoom();
    await loadParticipants();

    setIsLoading(false);
  }, [checkAccess, loadRoom, loadParticipants]);

  useEffect(() => {
    if (roomId) {
      initializeRoom();
    }
  }, [roomId, initializeRoom]);

  useEffect(() => {
    if (room && user) {
      setIsHost(room.host_id === user.id);

      // Find current participant
      const participant = participants.find((p) => p.user_id === user.id);
      setCurrentParticipant(participant || null);
    }
  }, [room, user, participants]);

  useEffect(() => {
    initializeDebate();
  }, [initializeDebate]);

  useEffect(() => {
    if (roomId) {
      const cleanup = setupSubscriptions();
      return cleanup;
    }
  }, [roomId, setupSubscriptions]);

  // Debate control functions
  const handleNextTurn = async () => {
    if (!isHost) return;

    const currentIndex = debateState.speaking_order.findIndex(
      (id) => id === debateState.current_speaker_id
    );
    const nextIndex = (currentIndex + 1) % debateState.speaking_order.length;
    const nextSpeakerId = debateState.speaking_order[nextIndex];

    const newState = {
      ...debateState,
      current_speaker_id: nextSpeakerId,
      turn_start_time: new Date().toISOString(),
    };

    setDebateState(newState);

    // Broadcast to all participants
    await supabase.channel(`debate_${roomId}_state`).send({
      type: "broadcast",
      event: "state_change",
      payload: newState,
    });

    // Send system message
    const nextSpeaker = participants.find((p) => p.user_id === nextSpeakerId);
    if (nextSpeaker) {
      await supabase.from("messages").insert({
        room_id: roomId,
        user_id: user?.id || "",
        content: `${nextSpeaker.profiles.full_name}'s turn to speak`,
        message_type: "system",
      });
    }
  };

  const handleEndDebate = async () => {
    if (!isHost || !room) return;

    const confirmed = window.confirm(
      "Are you sure you want to end this debate?"
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("rooms")
        .update({
          status: "completed",
          ended_at: new Date().toISOString(),
        })
        .eq("id", room.id);

      if (error) throw error;

      toast.success("Debate ended successfully");
      router.push(`/room/${roomId}`);
    } catch (error) {
      console.error("Error ending debate:", error);
      toast.error("Failed to end debate");
    }
  };

  const handleLeaveDebate = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to leave this debate?"
    );
    if (!confirmed) return;

    if (isHost) {
      toast.error("As the host, please end the debate for all participants");
      return;
    }

    router.push("/dashboard");
    toast.success("Left debate successfully");
  };

  if (isLoading) {
    return <LoadingSpinner text="Joining debate room..." />;
  }

  if (!room || !user) {
    return (
      <div className="min-h-screen bg-[#091717] flex items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold text-white">
            Debate room not found
          </h1>
          <p className="mb-6 text-white/70">
            The debate you&apos;re looking for doesn&apos;t exist or has ended.
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="bg-[#20808D] hover:bg-[#20808D]/90 text-white px-6 py-3 rounded-lg transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#091717] overflow-hidden relative">
      {/* Background Effects */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              background: `
              radial-gradient(circle at 25% 75%, rgba(32, 128, 141, 0.15) 0%, transparent 50%),
              radial-gradient(circle at 75% 25%, rgba(46, 86, 94, 0.15) 0%, transparent 50%)
            `,
            }}
          />
        </div>
      </div>

      {/* Debate Header */}
      <DebateHeader
        room={room}
        isHost={isHost}
        onLeaveDebate={handleLeaveDebate}
        onEndDebate={handleEndDebate}
        onToggleParticipants={() =>
          setShowParticipantsPanel(!showParticipantsPanel)
        }
        onToggleChat={() => setShowChatPanel(!showChatPanel)}
      />

      {/* Main Content */}
      <div className="relative z-10 h-[calc(100vh-80px)] flex">
        {/* Left Sidebar - Participants Panel */}
        <motion.div
          initial={{ x: -400 }}
          animate={{ x: showParticipantsPanel ? 0 : -400 }}
          transition={{ duration: 0.3 }}
          className="absolute top-0 left-0 z-20 h-full w-80"
        >
          <ParticipantsPanel
            participants={participants}
            currentSpeakerId={debateState.current_speaker_id}
            debateState={debateState}
            onClose={() => setShowParticipantsPanel(false)}
          />
        </motion.div>

        {/* Main Video Area */}
        <div className="relative flex flex-col flex-1">
          {/* Turn Management & Timer */}
          <div className="p-4 bg-gradient-to-r from-[#13343B]/90 to-[#2E565E]/90 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <TurnManagement
                participants={participants}
                debateState={debateState}
                currentUser={user}
              />

              <DebateTimer
                room={room}
                debateState={debateState}
                onTurnEnd={handleNextTurn}
              />
            </div>
          </div>

          {/* WebSocket Audio Streaming */}
          <div className="relative flex-1">
            <WebSocketAudioStreaming
              roomId={roomId}
              currentUser={user}
              participants={participants}
              debateState={debateState}
              userDisplayName={
                currentParticipant?.profiles.full_name || "Unknown"
              }
            />

            {/* Debate Controls Overlay */}
            <DebateControls
              room={room}
              isHost={isHost}
              debateState={debateState}
              onNextTurn={handleNextTurn}
              onEndDebate={handleEndDebate}
            />
          </div>
        </div>

        {/* Right Sidebar - Chat Panel */}
        <motion.div
          initial={{ x: 400 }}
          animate={{ x: showChatPanel ? 0 : 400 }}
          transition={{ duration: 0.3 }}
          className="absolute top-0 right-0 z-20 h-full w-80"
        >
          <DebateChat
            roomId={roomId}
            currentUser={user}
            onClose={() => setShowChatPanel(false)}
          />
        </motion.div>
      </div>

      {/* Audio Debug Panel */}
      <AudioDebugPanel
        show={showAudioDebug}
        onToggle={() => setShowAudioDebug(!showAudioDebug)}
      />
    </div>
  );
}
