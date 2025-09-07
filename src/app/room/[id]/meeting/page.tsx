// src/app/room/[id]/meeting/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import SocketGoogleMeetInterface from "@/components/meet/SocketGoogleMeetInterface";

interface Room {
  id: string;
  title: string;
  description: string;
  host_id: string;
  max_participants: number;
  is_active: boolean;
  created_at: string;
}

interface User {
  id: string;
  email?: string;
}

interface Participant {
  id: string;
  room_id: string;
  user_id: string;
  role: "host" | "participant";
  status: "joined" | "ready" | "speaking" | "muted";
  joined_at: string;
  ready_at?: string;
  is_online: boolean;
  profiles: {
    full_name: string;
    avatar_url?: string;
  };
}

interface Props {
  params: Promise<{ id: string }>;
}

export default function MeetingRoomPage({ params }: Props) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [roomId, setRoomId] = useState<string>("");

  useEffect(() => {
    document.title = "Meeting - Discourse AI";
  }, []);

  // Get current user
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await getCurrentUser();
        setUser(userData);
      } catch (error) {
        console.error("Error fetching user:", error);
      } finally {
        setAuthLoading(false);
      }
    };

    fetchUser();
  }, []);

  // Get room ID from params
  useEffect(() => {
    const getParams = async () => {
      const resolvedParams = await params;
      setRoomId(resolvedParams.id);
    };
    getParams();
  }, [params]);

  // Fetch room and participant data
  useEffect(() => {
    if (!roomId || !user) return;

    const fetchRoomData = async () => {
      try {
        setLoading(true);

        // Fetch room data
        const { data: roomData, error: roomError } = await supabase
          .from("rooms")
          .select("*")
          .eq("id", roomId)
          .single();

        if (roomError) {
          console.error("Error fetching room:", roomError);
          alert("Failed to load meeting room");
          router.push("/dashboard");
          return;
        }

        setRoom(roomData);

        // Fetch participants data
        const { data: participantsData, error: participantsError } =
          await supabase.from("participants").select("*").eq("room_id", roomId);

        if (participantsError) {
          console.error("Error fetching participants:", participantsError);
        } else {
          // Fetch profile data separately for each participant
          const participantsWithProfiles = await Promise.all(
            (participantsData || []).map(async (participant) => {
              const { data: profileData } = await supabase
                .from("profiles")
                .select("full_name, avatar_url")
                .eq("id", participant.user_id)
                .single();

              return {
                ...participant,
                role:
                  participant.role === "debater"
                    ? "participant"
                    : participant.role,
                profiles: profileData || {
                  full_name: "Unknown User",
                  avatar_url: null,
                },
              };
            })
          );

          setParticipants(participantsWithProfiles);
        }
      } catch (error) {
        console.error("Error in fetchRoomData:", error);
        alert("Failed to load meeting data");
      } finally {
        setLoading(false);
      }
    };

    fetchRoomData();
  }, [roomId, user, router]);

  // Subscribe to real-time participant updates
  useEffect(() => {
    if (!roomId) return;

    const participantsSubscription = supabase
      .channel(`participants-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participants",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          console.log("Participant update:", payload);

          if (payload.eventType === "INSERT") {
            // Fetch the profile data for the new participant
            const { data: profileData } = await supabase
              .from("profiles")
              .select("full_name, avatar_url")
              .eq("id", payload.new.user_id)
              .single();

            const newParticipant = {
              ...payload.new,
              role:
                payload.new.role === "debater"
                  ? "participant"
                  : payload.new.role,
              profiles: profileData || {
                full_name: "Unknown User",
                avatar_url: null,
              },
            } as Participant;

            setParticipants((prev) => {
              const exists = prev.find((p) => p.id === newParticipant.id);
              if (exists) return prev;
              return [...prev, newParticipant];
            });
          } else if (payload.eventType === "UPDATE") {
            setParticipants((prev) =>
              prev.map((p) =>
                p.id === payload.new.id
                  ? {
                      ...p,
                      ...payload.new,
                      role:
                        payload.new.role === "debater"
                          ? "participant"
                          : payload.new.role,
                    }
                  : p
              )
            );
          } else if (payload.eventType === "DELETE") {
            setParticipants((prev) =>
              prev.filter((p) => p.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      participantsSubscription.unsubscribe();
    };
  }, [roomId]);

  // Handle leaving the meeting
  const handleLeaveRoom = async () => {
    if (!user || !roomId) return;

    try {
      // Remove participant from database
      const { error } = await supabase
        .from("participants")
        .delete()
        .eq("room_id", roomId)
        .eq("user_id", user.id);

      if (error) {
        console.error("Error leaving room:", error);
        alert("Failed to leave meeting");
      } else {
        console.log("Left meeting successfully");
        router.push("/dashboard");
      }
    } catch (error) {
      console.error("Error in handleLeaveRoom:", error);
      alert("Failed to leave meeting");
    }
  };

  // Show loading spinner while authentication or room data is loading
  if (authLoading || loading) {
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

  // Redirect if not authenticated
  if (!user) {
    router.push("/login");
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

  // Show error if room not found
  if (!room) {
    return (
      <div className="min-h-screen bg-[#091717] flex items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold text-white">
            Meeting Not Found
          </h1>
          <p className="mb-6 text-white/70">
            The meeting room you&apos;re looking for doesn&apos;t exist or has
            been removed.
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

  // Get current user's display name
  const currentParticipant = participants.find((p) => p.user_id === user.id);
  const userDisplayName =
    currentParticipant?.profiles.full_name || user.email || "Unknown User";

  return (
    <SocketGoogleMeetInterface
      roomId={roomId}
      currentUser={user}
      participants={participants}
      userDisplayName={userDisplayName}
      onLeaveRoom={handleLeaveRoom}
    />
  );
}
