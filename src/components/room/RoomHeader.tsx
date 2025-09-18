// src/components/room/RoomHeader.tsx
"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, ArrowLeft, Copy, Users, Clock, Crown, Settings } from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"
import { toast } from "sonner"

interface Room {
  id: string
  title: string
  topic: string
  mode: "classic" | "corporate" | "interactive"
  status: "waiting" | "active" | "completed"
  current_participants: number
  max_participants: number
  host_id: string
  room_code: string
  created_at: string
  is_private: boolean
  profiles?: {
    full_name: string
    avatar_url?: string
  }
}

interface RoomHeaderProps {
  room: Room
  isHost: boolean
  onLeaveRoom: () => void
}

export default function RoomHeader({ room, isHost, onLeaveRoom }: RoomHeaderProps) {
  const copyRoomCode = () => {
    navigator.clipboard.writeText(room.room_code)
    toast.success("Room code copied to clipboard!")
  }

  const getModeColor = (mode: string) => {
    switch (mode) {
      case "classic": return "#02BD9B"
      case "corporate": return "#02BD9B"  
      case "interactive": return "#02BD9B"
      default: return "#02BD9B"
    }
  }

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case "classic": return Users
      case "corporate": return Settings
      case "interactive": return MessageSquare
      default: return MessageSquare
    }
  }

  const ModeIcon = getModeIcon(room.mode)

  return (
    <header className="relative z-10 border-b border-[#02BD9B]/30 bg-[#040404]/95 backdrop-blur-2xl shadow-xl shadow-[#02BD9B]/10">
      <div className="px-6 py-6 mx-auto max-w-7xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          {/* Left Side - Back Button & Room Info */}
          <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4 lg:space-x-6">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link href="/dashboard">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-[#02BD9B]/50 text-white hover:bg-[#02BD9B]/20 backdrop-blur-sm"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Dashboard</span>
                  <span className="sm:hidden">Back</span>
                </Button>
              </Link>
            </motion.div>

            <div className="flex items-center space-x-3 sm:space-x-4">
              {/* Mode Icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="relative"
              >
                <div
                  className="absolute inset-0 opacity-50 blur-xl rounded-2xl"
                  style={{ backgroundColor: getModeColor(room.mode) }}
                />
                <div
                  className="relative flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 border shadow-xl rounded-2xl border-white/20"
                  style={{
                    background: `linear-gradient(135deg, ${getModeColor(room.mode)}60, ${getModeColor(room.mode)}30)`,
                  }}
                >
                  <ModeIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
              </motion.div>

              {/* Room Title & Host */}
              <div className="min-w-0 flex-1">
                <motion.h1
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="flex items-center space-x-2 text-lg sm:text-xl lg:text-2xl font-bold text-white"
                >
                  <span className="truncate">{room.title}</span>
                  {isHost && (
                    <span title="You are the host">
                      <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 flex-shrink-0" />
                    </span>
                  )}
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="flex flex-wrap items-center gap-1 sm:gap-2 text-sm text-white/70"
                >
                  <span className="truncate">Hosted by {room.profiles?.full_name || "Unknown"}</span>
                  <span className="hidden sm:inline">•</span>
                  <Badge
                    style={{
                      backgroundColor: `${getModeColor(room.mode)}25`,
                      color: getModeColor(room.mode),
                      border: `1px solid ${getModeColor(room.mode)}40`
                    }}
                    className="text-xs font-semibold"
                  >
                    {room.mode}
                  </Badge>
                </motion.p>
              </div>
            </div>
          </div>

          {/* Right Side - Room Stats & Actions */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 lg:gap-6">
            {/* Participants Count */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="flex items-center space-x-1 sm:space-x-2 bg-[#02BD9B]/20 px-2 sm:px-3 lg:px-4 py-1 sm:py-2 rounded-full border border-[#02BD9B]/30"
            >
              <Users className="w-3 h-3 sm:w-4 sm:h-4 text-[#02BD9B]" />
              <span className="font-semibold text-white text-sm">
                {room.current_participants}/{room.max_participants}
              </span>
            </motion.div>

            {/* Room Code */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="flex items-center space-x-2 bg-[#040404]/60 px-2 sm:px-3 lg:px-4 py-1 sm:py-2 rounded-lg border border-[#02BD9B]/30 backdrop-blur-sm"
            >
              <div className="text-center">
                <div className="text-xs font-medium text-white/60 hidden sm:block">Room Code</div>
                <code className="text-[#02BD9B] font-mono font-bold text-sm sm:text-base lg:text-lg tracking-wider">
                  {room.room_code}
                </code>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={copyRoomCode}
                className="h-6 w-6 sm:h-8 sm:w-8 p-0 hover:bg-[#02BD9B]/20 text-[#02BD9B]"
              >
                <Copy className="w-3 h-3 sm:w-4 sm:h-4" />
              </Button>
            </motion.div>

            {/* Status */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 }}
            >
              <Badge className={`font-semibold px-2 sm:px-3 py-1 text-xs ${
                room.status === 'waiting'
                  ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'
                  : room.status === 'active'
                  ? 'bg-green-500/20 text-green-400 border-green-500/40'
                  : 'bg-gray-500/20 text-gray-400 border-gray-500/40'
              }`}>
                <span className="hidden sm:inline">
                  {room.status === 'waiting' ? 'Waiting to Start' :
                   room.status === 'active' ? 'Active' : 'Completed'}
                </span>
                <span className="sm:hidden">
                  {room.status === 'waiting' ? 'Waiting' :
                   room.status === 'active' ? 'Active' : 'Done'}
                </span>
              </Badge>
            </motion.div>

            {/* Leave Room Button */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                onClick={onLeaveRoom}
                variant="outline"
                size="sm"
                className="text-red-400 border-red-500/50 hover:bg-red-500/20 hover:border-red-500/70 text-xs sm:text-sm px-2 sm:px-3"
              >
                <span className="hidden sm:inline">Leave Room</span>
                <span className="sm:hidden">Leave</span>
              </Button>
            </motion.div>
          </div>
        </div>

        {/* Topic */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="mt-4 p-4 bg-[#040404]/60 rounded-xl border border-[#02BD9B]/20 backdrop-blur-sm"
        >
          <div className="mb-1 text-sm font-medium text-white/60">Debate Topic</div>
          <p className="text-lg leading-relaxed text-white">{room.topic}</p>
        </motion.div>
      </div>
    </header>
  )
}