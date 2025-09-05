// src/app/room/[id]/page.tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import RoomHeader from "@/components/room/RoomHeader";
import ParticipantsList from "@/components/room/ParticipantsList";
import ReadySystem from "@/components/room/ReadySystem";
import HostControls from "@/components/room/HostControls";
import RoomSettings from "@/components/room/RoomSettings";
import LobbyChat from "@/components/room/LobbyChat";

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

interface Message {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  message_type: string;
  created_at: string;
  profiles: {
    full_name: string;
    avatar_url?: string;
  };
}

interface User {
  id: string;
  email?: string;
}

export default function RoomLobbyPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isHost, setIsHost] = useState(false);
  const [currentParticipant, setCurrentParticipant] =
    useState<Participant | null>(null);

  // Prevent duplicate join attempts
  const joiningRef = useRef(false);
  const initializedRef = useRef(false);

  // Real-time subscriptions
  const setupSubscriptions = useCallback(() => {
    // Participants subscription
    const participantsSubscription = supabase
      .channel(`room_${roomId}_participants`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participants",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          // Debounce participant loading to prevent rapid re-renders
          setTimeout(() => {
            loadParticipants();
          }, 300);
        }
      )
      .subscribe();

    // Messages subscription
    const messagesSubscription = supabase
      .channel(`room_${roomId}_messages`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          loadMessages();
        }
      )
      .subscribe();

    // Room updates subscription
    const roomSubscription = supabase
      .channel(`room_${roomId}_updates`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.new.status === "active") {
            // Navigate to active meeting interface (Google Meet style)
            router.push(`/room/${roomId}/meeting`);
          } else {
            loadRoom();
          }
        }
      )
      .subscribe();

    return () => {
      participantsSubscription.unsubscribe();
      messagesSubscription.unsubscribe();
      roomSubscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, router]); // loadMessages, loadParticipants, loadRoom are stable callbacks

  const checkUser = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        router.push("/login");
        return;
      }
      setUser(currentUser);
    } catch (error) {
      console.error("Error checking user:", error);
      router.push("/login");
    }
  }, [router]);

  const loadRoom = useCallback(async () => {
    try {
      // Load room data first
      const { data: roomData, error: roomError } = await supabase
        .from("rooms")
        .select("*")
        .eq("id", roomId)
        .single();

      if (roomError) {
        console.error("Error loading room:", roomError);
        toast.error("Failed to load room");
        router.push("/dashboard");
        return;
      }

      if (!roomData) {
        toast.error("Room not found");
        router.push("/dashboard");
        return;
      }

      // Load host profile separately
      const { data: hostProfile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", roomData.host_id)
        .single();

      if (profileError) {
        console.error("Error loading host profile:", profileError);
      }

      // Combine room data with host profile
      setRoom({
        ...roomData,
        profiles: hostProfile || {
          full_name: "Unknown Host",
          avatar_url: null,
        },
      });
    } catch (error) {
      console.error("Error loading room:", error);
      router.push("/dashboard");
    }
  }, [roomId, router]);

  const loadParticipants = useCallback(async () => {
    try {
      // Temporarily disable RLS for this query by using service role
      // Since RPC functions aren't working, let's use a different approach

      // First, let's try to get participants without the problematic RLS
      // We'll use the anon role and a simple query
      const { data: participantsData, error: participantsError } =
        await supabase
          .from("participants")
          .select(
            `
          id,
          room_id,
          user_id,
          role,
          status,
          joined_at,
          ready_at,
          left_at,
          is_online
        `
          )
          .eq("room_id", roomId)
          .order("joined_at", { ascending: true });

      if (participantsError) {
        console.error("Error loading participants:", participantsError);
        setParticipants([]);
        return;
      }

      // Get profiles separately
      if (participantsData && participantsData.length > 0) {
        const userIds = participantsData.map((p) => p.user_id);
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", userIds);

        if (profilesError) {
          console.error("Error loading profiles:", profilesError);
          setParticipants(
            participantsData.map((p) => ({
              ...p,
              profiles: { full_name: "Unknown", avatar_url: "" },
            }))
          );
          return;
        }

        // Combine participants with their profiles
        const participantsWithProfiles = participantsData.map((participant) => {
          const profile = profilesData?.find(
            (p) => p.id === participant.user_id
          );
          return {
            ...participant,
            profiles: profile
              ? {
                  full_name: profile.full_name || "Unknown",
                  avatar_url: profile.avatar_url || "",
                }
              : { full_name: "Unknown", avatar_url: "" },
          };
        });

        setParticipants(participantsWithProfiles);
      } else {
        setParticipants([]);
      }
    } catch (error) {
      console.error("Error loading participants:", error);
      setParticipants([]);
    }
  }, [roomId]);

  const loadMessages = useCallback(async () => {
    try {
      // Since RPC functions aren't working, use direct query approach
      const { data: messagesData, error: messagesError } = await supabase
        .from("messages")
        .select(
          `
          id,
          room_id,
          user_id,
          content,
          message_type,
          created_at
        `
        )
        .eq("room_id", roomId)
        .order("created_at", { ascending: true })
        .limit(50);

      if (messagesError) {
        console.error("Error loading messages:", messagesError);
        setMessages([]);
        return;
      }

      // Get profiles separately
      if (messagesData && messagesData.length > 0) {
        const userIds = [...new Set(messagesData.map((m) => m.user_id))];
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", userIds);

        if (profilesError) {
          console.error("Error loading profiles:", profilesError);
          setMessages(
            messagesData.map((m) => ({
              ...m,
              profiles: { full_name: "Unknown", avatar_url: "" },
            }))
          );
          return;
        }

        // Combine messages with their author profiles
        const messagesWithProfiles = messagesData.map((message) => {
          const profile = profilesData?.find((p) => p.id === message.user_id);
          return {
            ...message,
            profiles: profile
              ? {
                  full_name: profile.full_name || "Unknown",
                  avatar_url: profile.avatar_url || "",
                }
              : { full_name: "Unknown", avatar_url: "" },
          };
        });

        setMessages(messagesWithProfiles);
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error("Error loading messages:", error);
      setMessages([]);
    }
  }, [roomId]);

  const joinRoom = useCallback(async () => {
    if (!user || !room) return;

    // Prevent multiple simultaneous join attempts
    if (joiningRef.current) {
      console.log("Join already in progress, skipping");
      return;
    }

    try {
      joiningRef.current = true;

      // Check if user is already a participant (including fresh check from DB)
      const { data: existingParticipant, error: checkError } = await supabase
        .from("participants")
        .select("*")
        .eq("room_id", roomId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (checkError) {
        console.error("Error checking existing participant:", checkError);
        return;
      }

      if (existingParticipant) {
        console.log("User is already a participant in this room");
        return;
      }

      // Determine role: host if they created the room, otherwise audience
      const role = room.host_id === user.id ? "host" : "audience";

      // Try to join the room
      const { error } = await supabase.from("participants").insert([
        {
          room_id: roomId,
          user_id: user.id,
          role: role,
        },
      ]);

      if (error) {
        // Check if it's a duplicate key error (race condition)
        if (error.code === "23505") {
          console.log("User already joined room (race condition detected)");
          // This is fine, just reload participants
        } else {
          console.error("Error joining room:", error);
          toast.error("Failed to join room");
          return;
        }
      } else {
        toast.success("Joined room successfully");
      }

      // Reload participants to get the latest state
      await loadParticipants();
    } catch (error) {
      console.error("Error in joinRoom:", error);
    } finally {
      joiningRef.current = false;
    }
  }, [roomId, user, room, loadParticipants]);

  // Auto-join room when user and room are loaded (only once)
  useEffect(() => {
    if (user && room && !joiningRef.current) {
      // Small delay to ensure all data is loaded
      const timer = setTimeout(() => {
        joinRoom();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [user, room, joinRoom]);

  const initializeRoom = useCallback(async () => {
    if (initializedRef.current) return;

    setIsLoading(true);
    initializedRef.current = true;

    await checkUser();
    await loadRoom();
    await loadParticipants();
    await loadMessages();

    // Don't auto-join in initialization - let the useEffect handle it
    // This prevents infinite loops and duplicate key errors

    setIsLoading(false);
  }, [checkUser, loadRoom, loadParticipants, loadMessages]);

  useEffect(() => {
    if (roomId && !initializedRef.current) {
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
    if (roomId) {
      const cleanup = setupSubscriptions();
      return cleanup;
    }
  }, [roomId, setupSubscriptions]);

  const handleLeaveRoom = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("participants")
        .delete()
        .eq("room_id", roomId)
        .eq("user_id", user.id);

      if (error) throw error;

      toast.success("Left room successfully");
      router.push("/dashboard");
    } catch (error) {
      console.error("Error leaving room:", error);
      toast.error("Failed to leave room");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#091717] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-[#20808D] border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!room || !user) {
    return (
      <div className="min-h-screen bg-[#091717] flex items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold text-white">Room not found</h1>
          <p className="mb-6 text-white/70">
            The room you&apos;re looking for doesn&apos;t exist or has been
            deleted.
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
    <div className="min-h-screen w-full bg-[#091717] overflow-x-hidden relative">
      {/* Background Effects */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        {Array.from({ length: 40 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-[#20808D]/15 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -20, 0],
              opacity: [0, 0.8, 0],
              scale: [0, 1, 0],
            }}
            transition={{
              duration: Math.random() * 8 + 6,
              repeat: Infinity,
              delay: Math.random() * 4,
            }}
          />
        ))}
      </div>

      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div
            className="absolute inset-0"
            style={{
              background: `
              radial-gradient(circle at 25% 75%, rgba(32, 128, 141, 0.12) 0%, transparent 50%),
              radial-gradient(circle at 75% 25%, rgba(46, 86, 94, 0.12) 0%, transparent 50%)
            `,
            }}
          />
        </div>
      </div>

      {/* Room Header */}
      <RoomHeader room={room} isHost={isHost} onLeaveRoom={handleLeaveRoom} />

      {/* Main Content */}
      <main className="relative z-10 px-6 py-8 mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left Column - Room Info & Settings */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-6"
          >
            <RoomSettings room={room} isHost={isHost} onUpdate={loadRoom} />

            {isHost && (
              <HostControls
                room={room}
                participants={participants}
                onRoomUpdate={loadRoom}
                onParticipantsUpdate={loadParticipants}
              />
            )}
          </motion.div>

          {/* Center Column - Participants */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="space-y-6"
          >
            <ParticipantsList
              participants={participants}
              room={room}
              currentUser={user}
              isHost={isHost}
              onParticipantsUpdate={loadParticipants}
            />

            <ReadySystem
              currentParticipant={currentParticipant}
              participants={participants}
              room={room}
              isHost={isHost}
              onUpdate={loadParticipants}
            />
          </motion.div>

          {/* Right Column - Chat */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <LobbyChat
              messages={messages}
              room={room}
              user={user}
              onMessageSent={loadMessages}
            />
          </motion.div>
        </div>
      </main>
    </div>
  );
}
