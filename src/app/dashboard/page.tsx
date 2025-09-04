// app/dashboard/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  Plus,
  Search,
  Users,
  Clock,
  Settings,
  LogOut,
  User,
  Eye,
  Copy,
  ChevronDown,
  Trash2,
  Lock,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { getCurrentUser, signOut } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
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
  host_profile?: {
    full_name: string;
    avatar_url?: string;
  };
}

interface UserProfile {
  id: string;
  full_name: string;
  total_debates: number;
  debates_won: number;
  avatar_url?: string;
}

interface User {
  id: string;
  email?: string;
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [myRooms, setMyRooms] = useState<Room[]>([]);
  const [filteredRooms, setFilteredRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMode, setSelectedMode] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"all" | "my">("all");
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showJoinRoom, setShowJoinRoom] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const router = useRouter();

  // Create Room Form
  const [roomTitle, setRoomTitle] = useState("");
  const [roomTopic, setRoomTopic] = useState("");
  const [roomMode, setRoomMode] = useState<
    "classic" | "corporate" | "interactive"
  >("classic");
  const [maxParticipants, setMaxParticipants] = useState(10);
  const [isPrivate, setIsPrivate] = useState(false);

  // Join Room Form
  const [joinCode, setJoinCode] = useState("");

  const checkUser = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        router.push("/login");
        return;
      }

      setUser(currentUser);

      // Load user profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .single();

      if (profileData) {
        setProfile(profileData);
      }
    } catch (error) {
      console.error("Error checking user:", error);
      router.push("/login");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const loadRooms = useCallback(async () => {
    if (!user?.id) {
      console.log("No user found, skipping room loading");
      return;
    }

    try {
      console.log("Loading rooms for user:", user.id);

      // Load all public rooms and user's private rooms
      const { data: allRoomsData, error: allRoomsError } = await supabase
        .from("rooms")
        .select("*")
        .or(`is_private.eq.false,host_id.eq.${user.id}`)
        .eq("status", "waiting")
        .order("created_at", { ascending: false });

      if (allRoomsError) {
        console.error("Error loading rooms:", allRoomsError);
        console.error("Error details:", JSON.stringify(allRoomsError, null, 2));
        toast.error(
          `Failed to load rooms: ${allRoomsError.message || "Unknown error"}`
        );
        return;
      }

      // Get unique host IDs from rooms
      const hostIds = [
        ...new Set(allRoomsData?.map((room) => room.host_id) || []),
      ];

      // Load host profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", hostIds);

      if (profilesError) {
        console.error("Error loading profiles:", profilesError);
      }

      // Map profiles to rooms
      const roomsWithProfiles =
        allRoomsData?.map((room) => ({
          ...room,
          host_profile:
            profilesData?.find((profile) => profile.id === room.host_id) ||
            null,
        })) || [];

      console.log("Loaded rooms with profiles:", roomsWithProfiles);
      console.log(
        "Room privacy check:",
        roomsWithProfiles.map((r) => ({
          title: r.title,
          is_private: r.is_private,
          host_id: r.host_id,
        }))
      );
      setRooms(roomsWithProfiles);

      // Load user's own rooms
      const { data: myRoomsData, error: myRoomsError } = await supabase
        .from("rooms")
        .select("*")
        .eq("host_id", user.id)
        .order("created_at", { ascending: false });

      if (myRoomsError) {
        console.error("Error loading my rooms:", myRoomsError);
        console.error(
          "MyRooms error details:",
          JSON.stringify(myRoomsError, null, 2)
        );
      } else {
        // Map profiles to my rooms (user's profile should already be in profilesData)
        const myRoomsWithProfiles =
          myRoomsData?.map((room) => ({
            ...room,
            host_profile:
              profilesData?.find((profile) => profile.id === room.host_id) ||
              null,
          })) || [];

        console.log("Loaded my rooms with profiles:", myRoomsWithProfiles);
        setMyRooms(myRoomsWithProfiles);
      }
    } catch (error) {
      console.error("Error loading rooms:", error);
      toast.error("Failed to load rooms");
    }
  }, [user]);

  const filterRooms = useCallback(() => {
    const currentRooms = viewMode === "my" ? myRooms : rooms;
    let filtered = currentRooms;

    if (searchTerm) {
      filtered = filtered.filter(
        (room) =>
          room.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          room.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
          room.host_profile?.full_name
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase())
      );
    }

    if (selectedMode !== "all") {
      filtered = filtered.filter((room) => room.mode === selectedMode);
    }

    setFilteredRooms(filtered);
  }, [rooms, myRooms, searchTerm, selectedMode, viewMode]);

  useEffect(() => {
    checkUser();
  }, [checkUser]);

  useEffect(() => {
    if (user) {
      loadRooms();

      // Subscribe to room changes
      const roomsSubscription = supabase
        .channel("rooms_changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "rooms" },
          () => {
            loadRooms();
          }
        )
        .subscribe();

      return () => {
        roomsSubscription.unsubscribe();
      };
    }
  }, [user, loadRooms]);

  useEffect(() => {
    filterRooms();
  }, [filterRooms]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("rooms")
        .insert([
          {
            title: roomTitle,
            topic: roomTopic,
            mode: roomMode,
            max_participants: maxParticipants,
            is_private: isPrivate,
            host_id: user.id,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Join the room as host
      await supabase.from("participants").insert([
        {
          room_id: data.id,
          user_id: user.id,
          role: "host",
        },
      ]);

      toast.success("Room created successfully!");
      setShowCreateRoom(false);
      setRoomTitle("");
      setRoomTopic("");
      setIsPrivate(false);
      loadRooms();
      router.push(`/room/${data.id}`);
    } catch (error) {
      console.error("Error creating room:", error);
      toast.error("Failed to create room");
    }
  };

  const handleDeleteRoom = async (roomId: string, roomTitle: string) => {
    if (!user) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${roomTitle}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("rooms")
        .delete()
        .eq("id", roomId)
        .eq("host_id", user.id); // Ensure only host can delete

      if (error) throw error;

      toast.success("Room deleted successfully!");
      loadRooms();
    } catch (error) {
      console.error("Error deleting room:", error);
      toast.error("Failed to delete room");
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const { data: roomData, error: roomError } = await supabase
        .from("rooms")
        .select("*")
        .eq("room_code", joinCode.toUpperCase())
        .single();

      if (roomError || !roomData) {
        toast.error("Room not found");
        return;
      }

      if (roomData.current_participants >= roomData.max_participants) {
        toast.error("Room is full");
        return;
      }

      // Check if already joined
      const { data: existingParticipant } = await supabase
        .from("participants")
        .select("*")
        .eq("room_id", roomData.id)
        .eq("user_id", user.id)
        .single();

      if (existingParticipant) {
        router.push(`/room/${roomData.id}`);
        return;
      }

      // Join the room
      await supabase.from("participants").insert([
        {
          room_id: roomData.id,
          user_id: user.id,
          role: "audience",
        },
      ]);

      toast.success("Joined room successfully!");
      setShowJoinRoom(false);
      setJoinCode("");
      router.push(`/room/${roomData.id}`);
    } catch (error) {
      console.error("Error joining room:", error);
      toast.error("Failed to join room");
    }
  };

  const handleSignOut = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      await signOut();
      toast.success("Signed out successfully");
      router.push("/");
    } catch (error) {
      console.error("Sign out error:", error);
      toast.error("Error signing out");
    }
  };

  const copyRoomCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Room code copied!");
  };

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

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case "classic":
        return Users;
      case "corporate":
        return Settings;
      case "interactive":
        return MessageSquare;
      default:
        return MessageSquare;
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

  return (
    <div className="min-h-screen w-full bg-[#091717] overflow-x-hidden relative">
      {/* Enhanced Background Effects */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        {Array.from({ length: 60 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-[#20808D]/20 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0, 1, 0],
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
        <div className="absolute inset-0 opacity-30">
          <div
            className="absolute inset-0"
            style={{
              background: `
              radial-gradient(circle at 25% 75%, rgba(32, 128, 141, 0.15) 0%, transparent 60%),
              radial-gradient(circle at 75% 25%, rgba(46, 86, 94, 0.15) 0%, transparent 60%),
              radial-gradient(circle at 50% 50%, rgba(32, 128, 141, 0.08) 0%, transparent 70%)
            `,
            }}
          />
        </div>

        <motion.div
          className="absolute inset-0 opacity-10"
          animate={{ backgroundPosition: ["0% 0%", "100% 100%"] }}
          transition={{ duration: 30, repeat: Infinity, repeatType: "reverse" }}
          style={{
            backgroundImage: `
              linear-gradient(rgba(32, 128, 141, 0.4) 1px, transparent 1px), 
              linear-gradient(90deg, rgba(32, 128, 141, 0.4) 1px, transparent 1px)
            `,
            backgroundSize: "50px 50px",
          }}
        />
      </div>

      {/* Enhanced Header */}
      <header className="relative z-10 border-b border-[#20808D]/30 bg-[#091717]/95 backdrop-blur-2xl shadow-xl shadow-[#20808D]/10">
        <div className="px-4 py-2 mx-auto max-w-7xl">
          <div className="flex items-center justify-between">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <Link href="/" className="flex items-center space-x-4 group">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#20808D] to-[#2E565E] rounded-3xl blur-lg opacity-60 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative w-12 h-12 bg-gradient-to-br from-[#20808D] to-[#2E565E] rounded-3xl flex items-center justify-center shadow-2xl border border-white/20">
                    <MessageSquare className="text-white w-7 h-7" />
                  </div>
                </div>
                <span className="text-3xl font-bold bg-gradient-to-r from-white via-[#20808D] to-white bg-clip-text text-transparent">
                  Discourse
                </span>
              </Link>
            </motion.div>

            {/* Right side - User controls */}
            <div className="flex items-center gap-4">
              {/* Sign Out Button */}
              <Button
                onClick={handleSignOut}
                className="h-10 px-4 py-2 text-white transition-all duration-300 border-2 shadow-xl bg-gradient-to-r from-red-600/20 to-red-700/20 hover:from-red-600/30 hover:to-red-700/30 border-red-600/40 hover:border-red-600/60 backdrop-blur-sm rounded-xl"
              >
                <LogOut className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Sign Out</span>
                <span className="sm:hidden">Out</span>
              </Button>

              {/* User Profile Dropdown */}
              <div className="relative">
                <Button
                  onClick={() => setShowProfile(!showProfile)}
                  className="bg-gradient-to-r from-[#20808D]/20 to-[#2E565E]/20 hover:from-[#20808D]/30 hover:to-[#2E565E]/30 text-white border-2 border-[#20808D]/40 hover:border-[#20808D]/60 transition-all duration-300 px-4 py-2 h-12 shadow-xl backdrop-blur-sm rounded-xl"
                >
                  <div className="flex items-center space-x-3">
                    {profile?.avatar_url ? (
                      <Image
                        src={profile.avatar_url}
                        alt="Avatar"
                        width={32}
                        height={32}
                        className="w-8 h-8 rounded-full border-2 border-[#20808D]/50"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-[#20808D]/30 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                    <div className="hidden text-left sm:block">
                      <div className="text-sm font-semibold">
                        {profile?.full_name || "User"}
                      </div>
                      <div className="text-xs text-white/70">{user?.email}</div>
                    </div>
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </Button>

                {showProfile && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="absolute right-0 top-full mt-2 w-64 bg-slate-900 border border-[#20808D]/40 rounded-xl shadow-2xl z-[99999] overflow-hidden"
                    style={{ backgroundColor: "#0f172a" }}
                  >
                    <div className="p-4">
                      {/* Compact User Info */}
                      <div className="flex items-center mb-3 space-x-3">
                        {profile?.avatar_url ? (
                          <Image
                            src={profile.avatar_url}
                            alt="Avatar"
                            width={40}
                            height={40}
                            className="w-10 h-10 rounded-full border-2 border-[#20808D]/50"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gradient-to-br from-[#20808D]/30 to-[#2E565E]/30 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-[#20808D]" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-white truncate">
                            {profile?.full_name}
                          </div>
                          <div className="text-xs truncate text-white/60">
                            {user?.email}
                          </div>
                        </div>
                      </div>

                      {/* Compact Stats */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-center p-2 bg-[#20808D]/15 rounded-lg border border-[#20808D]/20">
                          <div className="text-lg font-bold text-[#20808D]">
                            {profile?.total_debates || 0}
                          </div>
                          <div className="text-xs text-white/60">Debates</div>
                        </div>
                        <div className="text-center p-2 bg-[#20808D]/15 rounded-lg border border-[#20808D]/20">
                          <div className="text-lg font-bold text-[#20808D]">
                            {profile?.debates_won || 0}
                          </div>
                          <div className="text-xs text-white/60">Won</div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 px-6 py-8 mx-auto max-w-7xl">
        {/* Enhanced Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-12 text-center"
        >
          <h1 className="mb-4 text-4xl font-bold leading-tight text-white md:text-4xl">
            Welcome back,
            <span className="text-[#20808D] block sm:inline sm:ml-3">
              {profile?.full_name?.split(" ")[0] || "Debater"}!
            </span>
          </h1>
          <p className="max-w-3xl mx-auto text-xl text-white/80">
            Ready to engage in meaningful debates and sharpen your argumentation
            skills?
          </p>
        </motion.div>

        {/* Enhanced Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="flex flex-col justify-center gap-6 mb-12 sm:flex-row"
        >
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={() => setShowCreateRoom(true)}
              size="lg"
              className="bg-gradient-to-r from-[#20808D] to-[#2E565E] hover:from-[#20808D]/90 hover:to-[#2E565E]/90 text-white px-6 py-4 text-sm font-semibold shadow-2xl shadow-[#20808D]/30 border border-white/20"
            >
              <Plus className="w-4 h-4 mr-1" />
              Create New Room
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={() => setShowJoinRoom(true)}
              size="lg"
              variant="outline"
              className="border-2 border-[#20808D]/50 text-white hover:bg-[#20808D]/20 backdrop-blur-sm px-10 py-4 text-sm font-semibold shadow-xl"
            >
              <Search className="w-4 h-4 mr-1" />
              Join Room
            </Button>
          </motion.div>
        </motion.div>

        {/* Enhanced Search and Filter */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mb-12 space-y-6"
        >
          <div className="flex flex-col gap-6 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-6 w-6 text-[#20808D]" />
              <Input
                placeholder="Search rooms by title, topic, or host..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 pr-4 py-4 text-lg bg-[#13343B]/60 border-2 border-[#20808D]/30 text-white placeholder:text-white/60 focus:border-[#20808D] rounded-2xl backdrop-blur-sm shadow-xl"
              />
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex gap-3">
              {["all", "classic", "corporate", "interactive"].map((mode) => (
                <Button
                  key={mode}
                  variant={selectedMode === mode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedMode(mode)}
                  className={
                    selectedMode === mode
                      ? "bg-[#20808D] text-white hover:bg-[#20808D]/90 border-[#20808D] px-6 py-2 rounded-full font-semibold"
                      : "border-[#20808D]/40 text-white hover:bg-[#20808D]/20 px-6 py-2 rounded-full"
                  }
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Button>
              ))}
            </div>

            <div className="flex gap-3">
              {["all", "my"].map((view) => (
                <Button
                  key={view}
                  variant={viewMode === view ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode(view as "all" | "my")}
                  className={
                    viewMode === view
                      ? "bg-[#2E565E] text-white hover:bg-[#2E565E]/90 border-[#2E565E] px-4 py-2 rounded-full"
                      : "border-[#2E565E]/40 text-white hover:bg-[#2E565E]/20 px-4 py-2 rounded-full"
                  }
                >
                  {view === "all" ? "All Rooms" : "My Rooms"}
                </Button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Enhanced Rooms Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="grid gap-8 md:grid-cols-2 lg:grid-cols-3"
        >
          {filteredRooms.map((room, index) => {
            const ModeIcon = getModeIcon(room.mode);
            const isOwner = room.host_id === user?.id;

            console.log(
              `Room ${room.title}: is_private=${
                room.is_private
              }, isOwner=${isOwner}, host_id="${room.host_id}", user_id="${
                user?.id
              }", host_id_type=${typeof room.host_id}, user_id_type=${typeof user?.id}`
            );

            return (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                whileHover={{ y: -8, scale: 1.02 }}
                className="group"
              >
                <Card className="border-0 bg-gradient-to-br from-[#13343B]/90 to-[#2E565E]/60 backdrop-blur-2xl h-full hover:shadow-2xl hover:shadow-[#20808D]/20 transition-all duration-500 overflow-hidden relative">
                  {/* Private Room Indicator - Top Left */}
                  {room.is_private && (
                    <div className="absolute z-10 top-3 left-4">
                      <Badge className="text-xs text-red-400 border shadow-lg bg-red-500/90 border-red-500/60">
                        Private
                      </Badge>
                    </div>
                  )}

                  {/* Delete Button - Top Right */}
                  {isOwner && (
                    <div className="absolute z-10 top-3 right-4">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteRoom(room.id, room.title)}
                        className="p-2 text-red-300 transition-all duration-300 w-9 h-9 hover:bg-red-500/20 hover:text-red-400 bg-black/40 backdrop-blur-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}

                  <CardHeader className="px-6 pb-4 pt-9">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-4">
                        <motion.div
                          whileHover={{ rotate: 10, scale: 1.1 }}
                          className="relative"
                        >
                          <div
                            className="absolute inset-0 opacity-50 blur-xl rounded-2xl"
                            style={{ backgroundColor: getModeColor(room.mode) }}
                          />
                          <div
                            className="relative flex items-center justify-center w-16 h-16 border shadow-xl rounded-2xl border-white/20"
                            style={{
                              background: `linear-gradient(135deg, ${getModeColor(
                                room.mode
                              )}60, ${getModeColor(room.mode)}30)`,
                            }}
                          >
                            <ModeIcon className="w-8 h-8 text-white" />
                          </div>
                        </motion.div>

                        <div>
                          <CardTitle className="text-xl text-white group-hover:text-[#20808D] transition-colors duration-300">
                            {room.title}
                          </CardTitle>
                          <div className="flex items-center mt-1 space-x-2">
                            <span className="text-sm text-white/60">by</span>
                            <span className="text-sm text-[#20808D] font-semibold">
                              {room.host_profile?.full_name || "Unknown Host"}
                            </span>
                            {isOwner && (
                              <Badge className="bg-[#20808D]/20 text-[#20808D] border-0 text-xs">
                                Owner
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Badge
                          style={{
                            backgroundColor: `${getModeColor(room.mode)}25`,
                            color: "white",
                            border: `1px solid ${getModeColor(room.mode)}40`,
                          }}
                          className="font-semibold"
                        >
                          {room.mode}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <p className="mb-6 leading-relaxed text-white/90 line-clamp-3">
                      {room.topic}
                    </p>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="flex items-center space-x-2 text-white/70 bg-[#091717]/40 p-3 rounded-lg">
                        <Users className="w-5 h-5 text-[#20808D]" />
                        <span className="font-semibold">
                          {room.current_participants}/{room.max_participants}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-white/70 bg-[#091717]/40 p-3 rounded-lg">
                        <Clock className="w-5 h-5 text-[#20808D]" />
                        <span className="text-sm">
                          {new Date(room.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-medium text-white/60">
                          Room Code:
                        </span>
                        <code className="bg-[#20808D]/25 text-[#20808D] px-3 py-1 rounded-lg text-sm font-mono font-bold tracking-wider border border-[#20808D]/30">
                          {room.room_code}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyRoomCode(room.room_code)}
                          className="h-8 w-8 p-0 hover:bg-[#20808D]/20 text-[#20808D]"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Button
                        className="w-full bg-gradient-to-r from-[#20808D]/30 to-[#2E565E]/30 hover:from-[#20808D] hover:to-[#2E565E] text-white border-2 border-[#20808D]/50 hover:border-[#20808D] transition-all duration-300 py-3 text-lg font-semibold shadow-lg"
                        onClick={() => router.push(`/room/${room.id}`)}
                      >
                        <Eye className="w-5 h-5 mr-2" />
                        Join Room
                      </Button>
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        {filteredRooms.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-20 text-center"
          >
            <div className="mb-4 text-2xl font-bold text-white/60">
              {viewMode === "my"
                ? "You haven't created any rooms yet"
                : "No rooms found"}
            </div>
            <p className="mb-8 text-lg text-white/50">
              {viewMode === "my"
                ? "Create your first room to get started with debates"
                : "Try adjusting your search criteria or create a new room"}
            </p>
            <Button
              onClick={() => setShowCreateRoom(true)}
              className="bg-gradient-to-r from-[#20808D] to-[#2E565E] text-white px-8 py-3"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Room
            </Button>
          </motion.div>
        )}
      </main>

      {/* Enhanced Create Room Modal */}
      {showCreateRoom && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowCreateRoom(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg"
          >
            <Card className="border-0 bg-gradient-to-br from-[#13343B] to-[#2E565E] backdrop-blur-2xl shadow-2xl">
              <CardHeader className="pb-6">
                <CardTitle className="text-2xl font-bold text-white">
                  Create New Room
                </CardTitle>
                <p className="text-white/70">
                  Set up your debate room with custom settings
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateRoom} className="space-y-6">
                  <div>
                    <label className="block mb-3 text-sm font-semibold text-white/90">
                      Room Title
                    </label>
                    <Input
                      value={roomTitle}
                      onChange={(e) => setRoomTitle(e.target.value)}
                      placeholder="Enter an engaging room title"
                      className="bg-[#091717]/60 border-2 border-[#20808D]/30 text-white placeholder:text-white/60 focus:border-[#20808D] py-3 text-lg rounded-xl"
                      required
                    />
                  </div>

                  <div>
                    <label className="block mb-3 text-sm font-semibold text-white/90">
                      Debate Topic
                    </label>
                    <Input
                      value={roomTopic}
                      onChange={(e) => setRoomTopic(e.target.value)}
                      placeholder="What will you debate about?"
                      className="bg-[#091717]/60 border-2 border-[#20808D]/30 text-white placeholder:text-white/60 focus:border-[#20808D] py-3 text-lg rounded-xl"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block mb-3 text-sm font-semibold text-white/90">
                        Debate Mode
                      </label>
                      <select
                        value={roomMode}
                        onChange={(e) =>
                          setRoomMode(
                            e.target.value as
                              | "classic"
                              | "corporate"
                              | "interactive"
                          )
                        }
                        className="w-full bg-[#091717]/60 border-2 border-[#20808D]/30 rounded-xl text-white py-3 px-3 text-lg focus:border-[#20808D] focus:outline-none appearance-none"
                      >
                        <option value="classic">Classic Debate</option>
                        <option value="corporate">Corporate Training</option>
                        <option value="interactive">Interactive Mode</option>
                      </select>
                    </div>

                    <div>
                      <label className="block mb-3 text-sm font-semibold text-white/90">
                        Max Participants
                      </label>
                      <Input
                        type="number"
                        value={maxParticipants}
                        onChange={(e) =>
                          setMaxParticipants(Number(e.target.value))
                        }
                        min="2"
                        max="50"
                        className="bg-[#091717]/60 border-2 border-[#20808D]/30 text-white focus:border-[#20808D] py-3 text-lg rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 p-4 bg-[#091717]/40 rounded-xl border border-[#20808D]/20">
                    <input
                      type="checkbox"
                      id="private"
                      checked={isPrivate}
                      onChange={(e) => setIsPrivate(e.target.checked)}
                      className="w-5 h-5 text-[#20808D] bg-[#091717]/60 border-[#20808D]/30 rounded focus:ring-[#20808D] focus:ring-2"
                    />
                    <label
                      htmlFor="private"
                      className="flex items-center space-x-2 font-medium text-white/90"
                    >
                      <Lock className="w-4 h-4" />
                      <span>Private Room (invite-only)</span>
                    </label>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <Button
                      type="submit"
                      className="flex-1 bg-gradient-to-r from-[#20808D] to-[#2E565E] hover:from-[#20808D]/90 hover:to-[#2E565E]/90 text-white py-4 text-lg font-semibold shadow-xl"
                    >
                      Create Room
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowCreateRoom(false)}
                      className="px-8 border-2 border-[#20808D]/50 text-white hover:bg-[#20808D]/20 py-4"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}

      {/* Enhanced Join Room Modal */}
      {showJoinRoom && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowJoinRoom(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md"
          >
            <Card className="border-0 bg-gradient-to-br from-[#13343B] to-[#2E565E] backdrop-blur-2xl shadow-2xl">
              <CardHeader className="pb-6">
                <CardTitle className="text-2xl font-bold text-white">
                  Join Room
                </CardTitle>
                <p className="text-white/70">
                  Enter the room code to join a debate
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleJoinRoom} className="space-y-6">
                  <div>
                    <label className="block mb-3 text-sm font-semibold text-white/90">
                      Room Code
                    </label>
                    <Input
                      value={joinCode}
                      onChange={(e) =>
                        setJoinCode(e.target.value.toUpperCase())
                      }
                      placeholder="XXXXXX"
                      className="bg-[#091717]/60 border-2 border-[#20808D]/30 text-white font-mono text-center text-2xl tracking-[0.5em] placeholder:text-white/60 focus:border-[#20808D] py-4 rounded-xl"
                      maxLength={6}
                      required
                    />
                  </div>
                  <div className="flex gap-4 pt-4">
                    <Button
                      type="submit"
                      className="flex-1 bg-gradient-to-r from-[#20808D] to-[#2E565E] hover:from-[#20808D]/90 hover:to-[#2E565E]/90 text-white py-4 text-lg font-semibold shadow-xl"
                    >
                      Join Room
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowJoinRoom(false)}
                      className="px-8 border-2 border-[#20808D]/50 text-white hover:bg-[#20808D]/20 py-4"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}

      {/* Click outside to close profile */}
      {showProfile && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowProfile(false)}
        />
      )}
    </div>
  );
}
