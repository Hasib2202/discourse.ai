// src/components/room/RoomChat.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, Crown, Mic, Users, Bot } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

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

interface Room {
  id: string;
  title: string;
}

interface User {
  id: string;
  email?: string;
}

interface RoomChatProps {
  messages: Message[];
  room: Room;
  user: User;
  onMessageSent: () => void;
}

export default function RoomChat({
  messages,
  room,
  user,
  onMessageSent,
}: RoomChatProps) {
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const { error } = await supabase.from("messages").insert([
        {
          room_id: room.id,
          user_id: user.id,
          content: newMessage.trim(),
          message_type: "text",
        },
      ]);

      if (error) throw error;

      setNewMessage("");
      onMessageSent();
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const getRoleIcon = (messageType: string) => {
    switch (messageType) {
      case "system":
        return Bot;
      case "announcement":
        return Crown;
      default:
        return MessageSquare;
    }
  };

  const getMessageStyle = (messageType: string, isOwnMessage: boolean) => {
    if (messageType === "system") {
      return "bg-blue-500/10 border-blue-500/20 text-blue-400";
    }
    if (messageType === "announcement") {
      return "bg-yellow-500/10 border-yellow-500/20 text-yellow-400";
    }
    if (isOwnMessage) {
      return "bg-[#20808D]/20 border-[#20808D]/40 text-white ml-12";
    }
    return "bg-[#091717]/40 border-[#20808D]/20 text-white mr-12";
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Card className="border-0 bg-gradient-to-br from-[#13343B]/80 to-[#2E565E]/40 backdrop-blur-xl h-[600px] flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-3 text-white">
          <MessageSquare className="w-5 h-5 text-[#20808D]" />
          <span>Lobby Chat</span>
          <Badge className="bg-[#20808D]/20 text-[#20808D] border-[#20808D]/40 text-xs">
            {messages.length}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col flex-1 p-0">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 space-y-3 max-h-[450px]">
          <AnimatePresence>
            {messages.map((message) => {
              const isOwnMessage = message.user_id === user.id;
              const isSystemMessage = message.message_type === "system";
              const RoleIcon = getRoleIcon(message.message_type);

              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className={`p-3 rounded-lg border transition-all duration-300 ${getMessageStyle(
                    message.message_type,
                    isOwnMessage
                  )}`}
                >
                  {isSystemMessage ? (
                    <div className="flex items-center space-x-2 text-center">
                      <RoleIcon className="w-4 h-4" />
                      <span className="text-sm">{message.content}</span>
                      <span className="text-xs opacity-60">
                        {formatTime(message.created_at)}
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Message Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Avatar className="w-6 h-6">
                            <AvatarImage src={message.profiles.avatar_url} />
                            <AvatarFallback className="bg-[#20808D]/20 text-[#20808D] text-xs">
                              {message.profiles.full_name
                                .charAt(0)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-semibold">
                            {message.profiles.full_name}
                            {isOwnMessage && (
                              <span className="text-[#20808D] ml-1">(You)</span>
                            )}
                          </span>
                        </div>
                        <span className="text-xs opacity-60">
                          {formatTime(message.created_at)}
                        </span>
                      </div>

                      {/* Message Content */}
                      <div className="text-sm leading-relaxed">
                        {message.content}
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>

          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <MessageSquare className="w-12 h-12 mb-3 text-white/20" />
              <p className="text-white/40">No messages yet</p>
              <p className="text-sm text-white/30">Start the conversation!</p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="p-4 border-t border-[#20808D]/20">
          <form onSubmit={handleSendMessage} className="flex space-x-3">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-[#091717]/60 border-[#20808D]/30 text-white placeholder:text-white/60 focus:border-[#20808D] rounded-xl"
              disabled={sending}
              maxLength={500}
            />
            <Button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="bg-[#20808D] hover:bg-[#20808D]/90 text-white px-4 rounded-xl transition-all duration-300 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>

          <div className="flex justify-between mt-2 text-xs text-white/50">
            <span>Press Enter to send</span>
            <span>{newMessage.length}/500</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
