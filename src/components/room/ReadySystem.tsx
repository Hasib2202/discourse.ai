// src/components/room/ReadySystem.tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { CheckCircle2, Clock, Users, AlertTriangle } from "lucide-react"
import { motion } from "framer-motion"
import { supabase } from "@/lib/supabase"
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
}

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

interface ReadySystemProps {
  currentParticipant: Participant | null
  participants: Participant[]
  room: Room
  isHost: boolean
  onUpdate: () => void
}

export default function ReadySystem({ currentParticipant, participants, room, isHost, onUpdate }: ReadySystemProps) {
  const [loading, setLoading] = useState(false)

  if (!currentParticipant) return null

  const isReady = !!currentParticipant.ready_at
  const readyParticipants = participants.filter(p => p.ready_at)
  const totalParticipants = participants.length
  const readyCount = readyParticipants.length
  const readyPercentage = totalParticipants > 0 ? (readyCount / totalParticipants) * 100 : 0

  const handleReadyToggle = async () => {
    setLoading(true)
    try {
      const updates = isReady 
        ? { ready_at: null }
        : { ready_at: new Date().toISOString() }

      const { error } = await supabase
        .from('participants')
        .update(updates)
        .eq('id', currentParticipant.id)

      if (error) throw error

      // Send system message to chat
      if (!isReady) {
        await supabase
          .from('messages')
          .insert({
            room_id: room.id,
            user_id: currentParticipant.user_id,
            content: `${currentParticipant.profiles.full_name} is ready!`,
            message_type: 'system'
          })
      }

      toast.success(isReady ? "Marked as not ready" : "Marked as ready!")
      onUpdate()
    } catch (error) {
      console.error("Error updating ready status:", error)
      toast.error("Failed to update ready status")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-0 bg-gradient-to-br from-[#13343B]/80 to-[#2E565E]/40 backdrop-blur-xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2 text-lg text-white">
          <CheckCircle2 className={`w-5 h-5 ${isReady ? 'text-green-400' : 'text-white/40'}`} />
          <span>Ready Status</span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Room Readiness Overview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white/80">Room Readiness</span>
            <Badge className="bg-[#20808D]/20 text-[#20808D] border-[#20808D]/40 font-semibold text-xs">
              {readyCount}/{totalParticipants} Ready
            </Badge>
          </div>
          
          <Progress 
            value={readyPercentage} 
            className="h-2 bg-[#091717]/60 border border-[#20808D]/20"
          />
          
          <div className="text-sm text-center text-white/60">
            {readyPercentage.toFixed(0)}% of participants are ready
          </div>
        </div>

        {/* Current Status */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-[#091717]/40 border border-[#20808D]/20">
          <div className="flex items-center space-x-3">
            {isReady ? (
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            ) : (
              <Clock className="w-5 h-5 text-yellow-400" />
            )}
            <span className="font-semibold text-white">
              {isReady ? "Ready to Start" : "Not Ready"}
            </span>
          </div>
          
          <Badge className={`font-semibold ${
            isReady 
              ? 'bg-green-500/20 text-green-400 border-green-500/40' 
              : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'
          }`}>
            {isReady ? 'Ready' : 'Waiting'}
          </Badge>
        </div>

        {/* Ready Up Button */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Button
            onClick={handleReadyToggle}
            disabled={loading}
            size="lg"
            className={`w-full h-12 font-semibold text-lg transition-all duration-300 ${
              isReady
                ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/40'
                : 'bg-green-500/20 hover:bg-green-500/30 text-green-400 border-green-500/40'
            } border backdrop-blur-sm`}
          >
            {loading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-5 h-5 mr-2 border-2 border-white rounded-full border-t-transparent"
              />
            ) : isReady ? (
              <Clock className="w-5 h-5 mr-2" />
            ) : (
              <CheckCircle2 className="w-5 h-5 mr-2" />
            )}
            {loading ? 'Updating...' : isReady ? 'Mark Not Ready' : 'Ready Up!'}
          </Button>
        </motion.div>

        {/* Ready Participants List */}
        {readyParticipants.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-white/70">Ready Participants</h4>
            <div className="space-y-2">
              {readyParticipants.map((participant) => (
                <div key={participant.id} className="flex items-center p-2 space-x-2 border rounded-lg bg-green-500/10 border-green-500/20">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-white/90">{participant.profiles.full_name}</span>
                  <Badge className="text-xs text-green-400 bg-green-500/20 border-green-500/40">
                    {participant.role}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ready Time */}
        {isReady && currentParticipant.ready_at && (
          <div className="text-sm text-center text-white/60">
            Ready since {new Date(currentParticipant.ready_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}