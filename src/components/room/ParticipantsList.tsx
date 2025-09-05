// src/components/room/ParticipantsList.tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Users, 
  Crown, 
  Mic, 
  MicOff, 
  UserMinus, 
  UserPlus, 
  CheckCircle2,
  Clock
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

interface Participant {
  id: string
  room_id: string
  user_id: string
  role: "host" | "debater" | "audience"
  status: "joined" | "ready" | "speaking" | "muted"
  joined_at: string
  ready_at?: string
  is_online: boolean
  profiles: {
    full_name: string
    avatar_url?: string
  }
}

interface Room {
  id: string
  host_id: string
  max_participants: number
  current_participants: number
}

interface User {
  id: string
}

interface ParticipantsListProps {
  participants: Participant[]
  room: Room
  currentUser: User
  isHost: boolean
  onParticipantsUpdate: () => void
}

export default function ParticipantsList({ 
  participants, 
  room, 
  currentUser, 
  isHost, 
  onParticipantsUpdate 
}: ParticipantsListProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const handleRoleChange = async (participantId: string, newRole: "debater" | "audience") => {
    if (!isHost) return

    setActionLoading(participantId)
    try {
      const { error } = await supabase
        .from("participants")
        .update({ role: newRole })
        .eq("id", participantId)
        .eq("room_id", room.id)

      if (error) throw error

      toast.success(`Participant role updated to ${newRole}`)
      onParticipantsUpdate()
    } catch (error) {
      console.error("Error updating role:", error)
      toast.error("Failed to update participant role")
    } finally {
      setActionLoading(null)
    }
  }

  const handleRemoveParticipant = async (participantId: string, participantName: string) => {
    if (!isHost) return

    const confirmed = window.confirm(`Are you sure you want to remove ${participantName} from the room?`)
    if (!confirmed) return

    setActionLoading(participantId)
    try {
      const { error } = await supabase
        .from("participants")
        .delete()
        .eq("id", participantId)
        .eq("room_id", room.id)

      if (error) throw error

      toast.success("Participant removed from room")
      onParticipantsUpdate()
    } catch (error) {
      console.error("Error removing participant:", error)
      toast.error("Failed to remove participant")
    } finally {
      setActionLoading(null)
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case "host": return "#FFD700"
      case "debater": return "#20808D"
      case "audience": return "#6B7280"
      default: return "#6B7280"
    }
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "host": return { text: "Host", icon: Crown }
      case "debater": return { text: "Debater", icon: Mic }
      case "audience": return { text: "Audience", icon: Users }
      default: return { text: "Participant", icon: Users }
    }
  }

  const getStatusIcon = (status: string, isReady: boolean) => {
    if (isReady) return CheckCircle2
    if (status === "muted") return MicOff
    if (status === "speaking") return Mic
    return Clock
  }

  const getStatusColor = (status: string, isReady: boolean) => {
    if (isReady) return "#10B981"
    if (status === "muted") return "#EF4444"
    if (status === "speaking") return "#20808D"
    return "#6B7280"
  }

  // Group participants by role
  const hosts = participants.filter(p => p.role === "host")
  const debaters = participants.filter(p => p.role === "debater")
  const audience = participants.filter(p => p.role === "audience")

  return (
    <Card className="border-0 bg-gradient-to-br from-[#13343B]/80 to-[#2E565E]/40 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="flex items-center space-x-3 text-white">
          <Users className="w-5 h-5 text-[#20808D]" />
          <span>Participants ({participants.length}/{room.max_participants})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Host Section */}
        {hosts.length > 0 && (
          <div className="space-y-3">
            <h4 className="flex items-center space-x-2 text-sm font-semibold tracking-wide uppercase text-white/80">
              <Crown className="w-4 h-4 text-yellow-400" />
              <span>Host</span>
            </h4>
            <AnimatePresence>
              {hosts.map((participant) => {
                const roleBadge = getRoleBadge(participant.role)
                const StatusIcon = getStatusIcon(participant.status, !!participant.ready_at)
                const isCurrentUser = participant.user_id === currentUser.id
                
                return (
                  <motion.div
                    key={participant.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-300 ${
                      isCurrentUser 
                        ? 'bg-[#20808D]/20 border-[#20808D]/50' 
                        : 'bg-[#091717]/40 border-[#20808D]/20 hover:border-[#20808D]/40'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={participant.profiles.avatar_url} />
                          <AvatarFallback className="bg-[#20808D]/20 text-[#20808D] font-semibold">
                            {participant.profiles.full_name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {participant.is_online && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-[#091717] rounded-full"></div>
                        )}
                      </div>
                      
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-white">
                            {participant.profiles.full_name}
                            {isCurrentUser && <span className="text-[#20808D] ml-1">(You)</span>}
                          </span>
                        </div>
                        <div className="flex items-center mt-1 space-x-2">
                          <Badge
                            style={{ 
                              backgroundColor: `${getRoleColor(participant.role)}20`,
                              color: getRoleColor(participant.role),
                              border: `1px solid ${getRoleColor(participant.role)}40`
                            }}
                            className="text-xs font-medium"
                          >
                            <roleBadge.icon className="w-3 h-3 mr-1" />
                            {roleBadge.text}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <StatusIcon 
                        className="w-4 h-4" 
                        style={{ color: getStatusColor(participant.status, !!participant.ready_at) }}
                      />
                      
                      {/* Allow host to change their own role to debater */}
                      {isHost && isCurrentUser && participant.role === "host" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRoleChange(participant.id, "debater")}
                          disabled={actionLoading === participant.id}
                          className="h-8 px-2 text-xs hover:bg-[#20808D]/20 text-[#20808D] border border-[#20808D]/40"
                          title="Join as Debater"
                        >
                          Join as Debater
                        </Button>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Debaters Section */}
        {debaters.length > 0 && (
          <div className="space-y-3">
            <h4 className="flex items-center space-x-2 text-sm font-semibold tracking-wide uppercase text-white/80">
              <Mic className="w-4 h-4 text-[#20808D]" />
              <span>Debaters ({debaters.length})</span>
            </h4>
            <AnimatePresence>
              {debaters.map((participant) => {
                const roleBadge = getRoleBadge(participant.role)
                const StatusIcon = getStatusIcon(participant.status, !!participant.ready_at)
                const isCurrentUser = participant.user_id === currentUser.id
                
                return (
                  <motion.div
                    key={participant.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-300 ${
                      isCurrentUser 
                        ? 'bg-[#20808D]/20 border-[#20808D]/50' 
                        : 'bg-[#091717]/40 border-[#20808D]/20 hover:border-[#20808D]/40'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={participant.profiles.avatar_url} />
                          <AvatarFallback className="bg-[#20808D]/20 text-[#20808D] font-semibold">
                            {participant.profiles.full_name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {participant.is_online && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-[#091717] rounded-full"></div>
                        )}
                      </div>
                      
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-white">
                            {participant.profiles.full_name}
                            {isCurrentUser && <span className="text-[#20808D] ml-1">(You)</span>}
                          </span>
                        </div>
                        <div className="flex items-center mt-1 space-x-2">
                          <Badge
                            style={{ 
                              backgroundColor: `${getRoleColor(participant.role)}20`,
                              color: getRoleColor(participant.role),
                              border: `1px solid ${getRoleColor(participant.role)}40`
                            }}
                            className="text-xs font-medium"
                          >
                            <roleBadge.icon className="w-3 h-3 mr-1" />
                            {roleBadge.text}
                          </Badge>
                          {participant.ready_at && (
                            <Badge className="text-xs text-green-400 bg-green-500/20 border-green-500/40">
                              Ready
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <StatusIcon 
                        className="w-4 h-4" 
                        style={{ color: getStatusColor(participant.status, !!participant.ready_at) }}
                      />
                      
                      {isHost && !isCurrentUser && (
                        <div className="flex space-x-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRoleChange(participant.id, "audience")}
                            disabled={actionLoading === participant.id}
                            className="h-8 w-8 p-0 hover:bg-[#20808D]/20 text-[#20808D]"
                            title="Move to Audience"
                          >
                            <UserMinus className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveParticipant(participant.id, participant.profiles.full_name)}
                            disabled={actionLoading === participant.id}
                            className="w-8 h-8 p-0 text-red-400 hover:bg-red-500/20"
                            title="Remove from Room"
                          >
                            <UserMinus className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Audience Section */}
        {audience.length > 0 && (
          <div className="space-y-3">
            <h4 className="flex items-center space-x-2 text-sm font-semibold tracking-wide uppercase text-white/80">
              <Users className="w-4 h-4 text-gray-400" />
              <span>Audience ({audience.length})</span>
            </h4>
            <AnimatePresence>
              {audience.map((participant) => {
                const roleBadge = getRoleBadge(participant.role)
                const StatusIcon = getStatusIcon(participant.status, !!participant.ready_at)
                const isCurrentUser = participant.user_id === currentUser.id
                
                return (
                  <motion.div
                    key={participant.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-300 ${
                      isCurrentUser 
                        ? 'bg-[#20808D]/20 border-[#20808D]/50' 
                        : 'bg-[#091717]/40 border-[#20808D]/20 hover:border-[#20808D]/40'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={participant.profiles.avatar_url} />
                          <AvatarFallback className="bg-[#20808D]/20 text-[#20808D] font-semibold">
                            {participant.profiles.full_name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {participant.is_online && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-[#091717] rounded-full"></div>
                        )}
                      </div>
                      
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-white">
                            {participant.profiles.full_name}
                            {isCurrentUser && <span className="text-[#20808D] ml-1">(You)</span>}
                          </span>
                        </div>
                        <div className="flex items-center mt-1 space-x-2">
                          <Badge
                            style={{ 
                              backgroundColor: `${getRoleColor(participant.role)}20`,
                              color: getRoleColor(participant.role),
                              border: `1px solid ${getRoleColor(participant.role)}40`
                            }}
                            className="text-xs font-medium"
                          >
                            <roleBadge.icon className="w-3 h-3 mr-1" />
                            {roleBadge.text}
                          </Badge>
                          {participant.ready_at && (
                            <Badge className="text-xs text-green-400 bg-green-500/20 border-green-500/40">
                              Ready
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <StatusIcon 
                        className="w-4 h-4" 
                        style={{ color: getStatusColor(participant.status, !!participant.ready_at) }}
                      />
                      
                      {isHost && !isCurrentUser && (
                        <div className="flex space-x-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRoleChange(participant.id, "debater")}
                            disabled={actionLoading === participant.id}
                            className="h-8 w-8 p-0 hover:bg-[#20808D]/20 text-[#20808D]"
                            title="Promote to Debater"
                          >
                            <UserPlus className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveParticipant(participant.id, participant.profiles.full_name)}
                            disabled={actionLoading === participant.id}
                            className="w-8 h-8 p-0 text-red-400 hover:bg-red-500/20"
                            title="Remove from Room"
                          >
                            <UserMinus className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Empty State */}
        {participants.length === 0 && (
          <div className="py-8 text-center">
            <Users className="w-12 h-12 mx-auto mb-3 text-white/40" />
            <p className="text-white/60">No participants yet</p>
            <p className="text-sm text-white/40">Share the room code to invite others</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}