// src/components/room/LobbyChat.tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, Send } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
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

interface Message {
  id: string
  room_id: string
  user_id: string
  content: string
  message_type: string
  created_at: string
  profiles: {
    full_name: string
    avatar_url?: string
  }
}

interface User {
  id: string
  email?: string
}

interface LobbyChatProps {
  messages: Message[]
  room: Room
  user: User
  onMessageSent: () => void
}

export default function LobbyChat({ messages, room, user, onMessageSent }: LobbyChatProps) {
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(false)

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || loading) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          room_id: room.id,
          user_id: user.id,
          content: newMessage.trim(),
          message_type: 'text'
        })

      if (error) throw error

      setNewMessage("")
      onMessageSent()
    } catch (error) {
      console.error("Error sending message:", error)
      toast.error("Failed to send message")
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  return (
    <Card className="h-[600px] border-0 bg-gradient-to-br from-[#040404]/80 to-[#02BD9B]/40 backdrop-blur-xl flex flex-col">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center space-x-3 text-white">
          <MessageSquare className="w-5 h-5 text-[#02BD9B]" />
          <span>Lobby Chat</span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex flex-col flex-1 space-y-4 overflow-hidden">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#02BD9B]/30 hover:scrollbar-thumb-[#02BD9B]/50">
          <AnimatePresence>
            {messages.map((message) => {
              const isCurrentUser = message.user_id === user.id
              
              if (message.message_type === 'system') {
                return (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="py-2 text-center"
                  >
                    <Badge className="bg-[#02BD9B]/20 text-[#02BD9B] border-[#02BD9B]/30 text-xs">
                      {message.content}
                    </Badge>
                  </motion.div>
                )
              }

              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className={`flex items-start space-x-3 ${isCurrentUser ? 'flex-row-reverse space-x-reverse' : ''}`}
                >
                  <Avatar className="flex-shrink-0 w-8 h-8">
                    <AvatarImage src={message.profiles.avatar_url} />
                    <AvatarFallback className="bg-[#02BD9B]/20 text-[#02BD9B] text-xs font-semibold">
                      {message.profiles.full_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className={`flex-1 ${isCurrentUser ? 'text-right' : ''}`}>
                    <div className={`flex items-center space-x-2 ${isCurrentUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
                      <span className="text-sm font-semibold text-white/90">
                        {message.profiles.full_name}
                        {isCurrentUser && <span className="text-[#02BD9B] ml-1">(You)</span>}
                      </span>
                      
                      <span className="text-xs text-white/50">
                        {formatTime(message.created_at)}
                      </span>
                    </div>
                    
                    <div className={`mt-1 ${isCurrentUser ? 'text-right' : ''}`}>
                      <div className={`inline-block p-3 rounded-lg max-w-xs break-words ${
                        isCurrentUser 
                          ? 'bg-[#02BD9B]/30 border border-[#02BD9B]/40 text-white' 
                          : 'bg-[#040404]/60 border border-[#02BD9B]/20 text-white/90'
                      }`}>
                        <p className="text-sm leading-relaxed">{message.content}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
          
          {messages.length === 0 && (
            <div className="py-8 text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 text-white/40" />
              <p className="text-white/60">No messages yet</p>
              <p className="text-sm text-white/40">Start the conversation!</p>
            </div>
          )}
        </div>

        {/* Message Input */}
        <div className="border-t border-[#02BD9B]/20 pt-4">
          <form onSubmit={sendMessage} className="flex space-x-3">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 bg-[#040404]/60 border-[#02BD9B]/30 text-white placeholder:text-white/50 focus:border-[#02BD9B]/60 focus:ring-[#02BD9B]/20"
              disabled={loading}
              maxLength={500}
            />
            <Button
              type="submit"
              disabled={!newMessage.trim() || loading}
              className="bg-[#02BD9B] hover:bg-[#02BD9B]/90 text-[#040404] font-semibold px-6"
            >
              {loading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 border-2 border-white rounded-full border-t-transparent"
                />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>
          
          <div className="flex items-center justify-between mt-2 text-xs text-white/50">
            <span>Press Enter to send</span>
            <span>{newMessage.length}/500</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}