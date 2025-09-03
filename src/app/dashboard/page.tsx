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
} from "lucide-react";
import Link from "next/link";
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
  profiles?: {
    full_name: string;
  };
}

interface UserProfile {
  id: string;
  full_name: string;
  total_debates: number;
  debates_won: number;
}

interface User {
  id: string;
  email?: string;
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [filteredRooms, setFilteredRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMode, setSelectedMode] = useState<string>("all");
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

      setProfile(profileData);
    } catch (error) {
      console.error("Error checking user:", error);
      router.push("/login");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const loadRooms = useCallback(async () => {
    try {
      console.log("Testing database connection...");

      // Test 1: Check if we can connect to Supabase
      const { error: connectionError } = await supabase
        .from("profiles")
        .select("count", { count: "exact", head: true });

      if (connectionError) {
        console.error("Connection test failed:", connectionError);
        toast.error("Database connection failed");
        return;
      }

      console.log("Database connected successfully");

      // Test 2: Check if rooms table exists and is accessible
      const { data, error } = await supabase.from("rooms").select("*").limit(5);

      if (error) {
        console.error("Supabase error:", error);
        if (error.code === "42P01") {
          toast.error(
            "Rooms table does not exist. Please create the database schema."
          );
        } else if (error.code === "42501") {
          toast.error("Permission denied. Please check RLS policies.");
        } else {
          toast.error(`Database error: ${error.message}`);
        }
        return;
      }

      console.log("Loaded rooms:", data);
      setRooms(data || []);

      if (data?.length === 0) {
        toast.success("Connected to database successfully! No rooms found.");
      }
    } catch (error) {
      console.error("Error loading rooms:", error);
      toast.error(
        "Failed to load rooms. Please check your database connection."
      );
    }
  }, []);

  const filterRooms = useCallback(() => {
    let filtered = rooms;

    if (searchTerm) {
      filtered = filtered.filter(
        (room) =>
          room.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          room.topic.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedMode !== "all") {
      filtered = filtered.filter((room) => room.mode === selectedMode);
    }

    setFilteredRooms(filtered);
  }, [rooms, searchTerm, selectedMode]);

  useEffect(() => {
    checkUser();
    loadRooms();

    // Subscribe to room changes
    const roomsSubscription = supabase
      .channel("rooms")
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
  }, [checkUser, loadRooms]);

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
      router.push(`/room/${data.id}`);
    } catch (error) {
      console.error("Error creating room:", error);
      toast.error("Failed to create room");
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

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#20808D]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#091717] overflow-x-hidden relative">
      {/* Background Effects */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        {Array.from({ length: 50 }).map((_, i) => (
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
              duration: Math.random() * 6 + 4,
              repeat: Infinity,
              delay: Math.random() * 3,
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
              radial-gradient(circle at 20% 80%, rgba(32, 128, 141, 0.1) 0%, transparent 50%),
              radial-gradient(circle at 80% 20%, rgba(46, 86, 94, 0.1) 0%, transparent 50%)
            `,
            }}
          />
        </div>
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-[#20808D]/20 bg-[#091717]/90 backdrop-blur-xl">
        <div className="px-6 py-4 mx-auto max-w-7xl">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#20808D] to-[#2E565E] rounded-2xl flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-white">Discourse</span>
            </Link>

            <div className="relative">
              <Button
                onClick={() => setShowProfile(!showProfile)}
                className="bg-[#20808D]/20 hover:bg-[#20808D]/30 text-white border border-[#20808D]/30"
              >
                <User className="w-4 h-4 mr-2" />
                {profile?.full_name || user?.email}
              </Button>

              {showProfile && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute right-0 top-12 w-64 bg-[#13343B] border border-[#20808D]/30 rounded-xl shadow-xl backdrop-blur-xl z-50"
                >
                  <div className="p-4">
                    <div className="mb-2 font-semibold text-white">
                      {profile?.full_name}
                    </div>
                    <div className="mb-4 text-sm text-white/60">
                      {user?.email}
                    </div>
                    <div className="mb-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-white/70">Total Debates:</span>
                        <span className="text-[#20808D]">
                          {profile?.total_debates || 0}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-white/70">Debates Won:</span>
                        <span className="text-[#20808D]">
                          {profile?.debates_won || 0}
                        </span>
                      </div>
                    </div>
                    <Button
                      onClick={handleSignOut}
                      variant="outline"
                      size="sm"
                      className="w-full border-[#20808D]/30 text-white hover:bg-[#20808D]/10"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </Button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 px-6 py-8 mx-auto max-w-7xl">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="mb-2 text-4xl font-bold text-white">
            Welcome back, {profile?.full_name?.split(" ")[0] || "Debater"}!
          </h1>
          <p className="text-lg text-white/70">
            Ready to join or create a debate room?
          </p>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col gap-4 mb-8 sm:flex-row"
        >
          <Button
            onClick={() => setShowCreateRoom(true)}
            size="lg"
            className="bg-gradient-to-r from-[#20808D] to-[#2E565E] hover:from-[#20808D]/90 hover:to-[#2E565E]/90 text-white px-8 py-4"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Room
          </Button>
          <Button
            onClick={() => setShowJoinRoom(true)}
            size="lg"
            variant="outline"
            className="border-[#20808D]/50 text-white hover:bg-[#20808D]/10 px-8 py-4"
          >
            <Search className="w-5 h-5 mr-2" />
            Join Room
          </Button>
        </motion.div>

        {/* Search and Filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col gap-4 mb-8 sm:flex-row"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-[#20808D]" />
            <Input
              placeholder="Search rooms..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-[#13343B]/50 border border-[#20808D]/30 text-white placeholder:text-white"
            />
          </div>
          <div className="flex gap-2">
            {["all", "classic", "corporate", "interactive"].map((mode) => (
              <Button
                key={mode}
                variant={selectedMode === mode ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedMode(mode)}
                className={
                  selectedMode === mode
                    ? "bg-[#20808D] text-white"
                    : "border-[#20808D]/30 text-white hover:bg-[#20808D]/10"
                }
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Button>
            ))}
          </div>
        </motion.div>

        {/* Rooms Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
        >
          {filteredRooms.map((room, index) => {
            const ModeIcon = getModeIcon(room.mode);
            return (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -5 }}
              >
                <Card className="border-0 bg-gradient-to-br from-[#13343B]/80 to-[#2E565E]/40 backdrop-blur-xl h-full hover:shadow-xl transition-all duration-300">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div
                          className="flex items-center justify-center w-12 h-12 rounded-xl"
                          style={{
                            background: `linear-gradient(135deg, ${getModeColor(
                              room.mode
                            )}40, ${getModeColor(room.mode)}20)`,
                          }}
                        >
                          <ModeIcon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-lg text-white">
                            {room.title}
                          </CardTitle>
                          <p className="text-sm text-white/60">
                            by {room.profiles?.full_name || "Unknown Host"}
                          </p>
                        </div>
                      </div>
                      <Badge
                        style={{
                          backgroundColor: `${getModeColor(room.mode)}20`,
                          color: getModeColor(room.mode),
                        }}
                        className="border-0"
                      >
                        {room.mode}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="mb-4 text-white/80 line-clamp-2">
                      {room.topic}
                    </p>

                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2 text-white/60">
                        <Users className="w-4 h-4" />
                        <span className="text-sm">
                          {room.current_participants}/{room.max_participants}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-white/60">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm">
                          {new Date(room.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-white/60">Code:</span>
                        <code className="bg-[#20808D]/20 text-[#20808D] px-2 py-1 rounded text-sm font-mono">
                          {room.room_code}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyRoomCode(room.room_code)}
                          className="h-6 w-6 p-0 hover:bg-[#20808D]/20"
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>

                      <Button
                        size="sm"
                        className="bg-[#20808D]/20 hover:bg-[#20808D] text-white border border-[#20808D]/30"
                        onClick={() => router.push(`/room/${room.id}`)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Join
                      </Button>
                    </div>
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
            className="py-12 text-center"
          >
            <div className="mb-4 text-lg text-white/60">No rooms found</div>
            <p className="text-white/40">
              Try adjusting your search or create a new room
            </p>
          </motion.div>
        )}
      </main>

      {/* Create Room Modal */}
      {showCreateRoom && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowCreateRoom(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md"
          >
            <Card className="border-0 bg-gradient-to-br from-[#13343B] to-[#2E565E] backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-white">Create New Room</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateRoom} className="space-y-4">
                  <div>
                    <label className="block mb-2 text-sm font-medium text-white/90">
                      Room Title
                    </label>
                    <Input
                      value={roomTitle}
                      onChange={(e) => setRoomTitle(e.target.value)}
                      placeholder="Enter room title"
                      className="bg-[#091717]/50 border-[#20808D]/30 text-white placeholder:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-medium text-white/90">
                      Topic
                    </label>
                    <Input
                      value={roomTopic}
                      onChange={(e) => setRoomTopic(e.target.value)}
                      placeholder="What will you debate about?"
                      className="bg-[#091717]/50 border-[#20808D]/30 text-white placeholder:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-medium text-white/90">
                      Mode
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
                      className="w-full p-2 bg-[#091717]/50 border border-[#20808D]/30 rounded-md text-white"
                    >
                      <option value="classic">Classic Debate</option>
                      <option value="corporate">Corporate Training</option>
                      <option value="interactive">Interactive Mode</option>
                    </select>
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-medium text-white/90">
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
                      className="bg-[#091717]/50 border-[#20808D]/30 text-white placeholder:text-white"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      type="submit"
                      className="flex-1 bg-[#20808D] hover:bg-[#20808D]/90"
                    >
                      Create Room
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowCreateRoom(false)}
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

      {/* Join Room Modal */}
      {showJoinRoom && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowJoinRoom(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md"
          >
            <Card className="border-0 bg-gradient-to-br from-[#13343B] to-[#2E565E] backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-white">Join Room</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleJoinRoom} className="space-y-4">
                  <div>
                    <label className="block mb-2 text-sm font-medium text-white/90">
                      Room Code
                    </label>
                    <Input
                      value={joinCode}
                      onChange={(e) =>
                        setJoinCode(e.target.value.toUpperCase())
                      }
                      placeholder="Enter 6-digit room code"
                      className="bg-[#091717]/50 border-[#20808D]/30 text-white font-mono text-center text-lg tracking-widest placeholder:text-white"
                      maxLength={6}
                      required
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      type="submit"
                      className="flex-1 bg-[#20808D] hover:bg-[#20808D]/90"
                    >
                      Join Room
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowJoinRoom(false)}
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
    </div>
  );
}
