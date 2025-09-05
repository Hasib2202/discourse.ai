// src/components/debate/DebateChat.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  Send,
  Crown,
  Mic,
  Bot,
  X,
  Clock,
  Info,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface Message {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  message_type:
    | "text"
    | "system"
    | "announcement"
    | "turn_change"
    | "phase_change";
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

interface DebateChatProps {
  roomId: string;
  currentUser: User;
  onClose: () => void;
}

export default function DebateChat({
  roomId,
  currentUser,
  onClose,
}: DebateChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isVisible) {
      scrollToBottom();
      setUnreadCount(0);
    }
  }, [messages, isVisible]);

  // Load initial messages
  const loadMessages = useCallback(async () => {
    try {
      // First get messages data
      const { data: messagesData, error: messagesError } = await supabase
        .from("messages")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true })
        .limit(100);

      if (messagesError) throw messagesError;

      if (!messagesData || messagesData.length === 0) {
        setMessages([]);
        return;
      }

      // Get unique user IDs (excluding system messages)
      const userIds = [
        ...new Set(
          messagesData
            .filter((m) => m.user_id && m.message_type === "text")
            .map((m) => m.user_id)
        ),
      ];

      // Get profiles for message authors
      let profilesData: Array<{
        id: string;
        full_name: string;
        avatar_url?: string;
      }> = [];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", userIds);
        profilesData = profiles || [];
      }

      // Combine messages with their profiles
      const messagesWithProfiles = messagesData.map((message) => {
        if (message.message_type === "system" || !message.user_id) {
          return {
            ...message,
            profiles: {
              full_name: "System",
              avatar_url: null,
            },
          };
        }

        const profile = profilesData.find((p) => p.id === message.user_id);
        return {
          ...message,
          profiles: profile || {
            full_name: "Unknown User",
            avatar_url: null,
          },
        };
      });

      setMessages(messagesWithProfiles);
    } catch (error) {
      console.error("Error loading messages:", error);
      toast.error("Failed to load chat messages");
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  // Setup real-time subscription
  useEffect(() => {
    loadMessages();

    const subscription = supabase
      .channel(`debate_chat_${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const newMessage = payload.new as Message;

          // Handle real-time message with profile loading
          if (newMessage.message_type === "system" || !newMessage.user_id) {
            // System message
            newMessage.profiles = {
              full_name: "System",
              avatar_url: undefined,
            };
            setMessages((prev) => [...prev, newMessage]);
          } else {
            // User message - load profile
            const { data: profile } = await supabase
              .from("profiles")
              .select("id, full_name, avatar_url")
              .eq("id", newMessage.user_id)
              .single();

            newMessage.profiles = profile || {
              full_name: "Unknown User",
              avatar_url: undefined,
            };
            setMessages((prev) => [...prev, newMessage]);
          }

          // Increment unread count if chat is not visible
          if (!isVisible) {
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [roomId, isVisible, loadMessages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const { error } = await supabase.from("messages").insert([
        {
          room_id: roomId,
          user_id: currentUser.id,
          content: newMessage.trim(),
          message_type: "text",
        },
      ]);

      if (error) throw error;

      setNewMessage("");
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
      case "turn_change":
        return Mic;
      case "phase_change":
        return Clock;
      default:
        return MessageSquare;
    }
  };

  const getMessageStyle = (messageType: string, isOwnMessage: boolean) => {
    if (messageType === "system" || messageType === "turn_change") {
      return "bg-blue-500/10 border-blue-500/20 text-blue-400 mx-4";
    }
    if (messageType === "announcement") {
      return "bg-yellow-500/10 border-yellow-500/20 text-yellow-400 mx-4";
    }
    if (messageType === "phase_change") {
      return "bg-purple-500/10 border-purple-500/20 text-purple-400 mx-4";
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

  const getMessageTypeLabel = (messageType: string) => {
    switch (messageType) {
      case "turn_change":
        return "Turn Update";
      case "phase_change":
        return "Phase Change";
      case "announcement":
        return "Announcement";
      case "system":
        return "System";
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="h-full w-80 bg-[#091717]/95 backdrop-blur-xl border-l border-[#20808D]/30 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#20808D] border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-white/60">Loading chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-80 bg-[#091717]/95 backdrop-blur-xl border-l border-[#20808D]/30 flex flex-col">
      {/* Chat Header */}
      <div className="p-4 border-b border-[#20808D]/30 bg-gradient-to-r from-[#13343B]/90 to-[#2E565E]/90">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-3">
            <MessageSquare className="w-5 h-5 text-[#20808D]" />
            <h3 className="text-lg font-semibold text-white">Debate Chat</h3>
            {unreadCount > 0 && (
              <Badge className="bg-red-500 text-white px-2 py-1 text-xs">
                {unreadCount}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white/60 hover:text-white hover:bg-white/10 p-1 h-8 w-8"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="text-sm text-white/60">
          Real-time discussion during the debate
        </div>
      </div>

      {/* Messages Container */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-0 py-4 space-y-3"
        onScroll={() => setIsVisible(true)}
      >
        <AnimatePresence>
          {messages.map((message) => {
            const isOwnMessage = message.user_id === currentUser.id;
            const isSystemMessage = [
              "system",
              "turn_change",
              "phase_change",
              "announcement",
            ].includes(message.message_type);
            const RoleIcon = getRoleIcon(message.message_type);
            const messageTypeLabel = getMessageTypeLabel(message.message_type);

            return (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className={`p-3 rounded-lg border transition-all duration-300 ${getMessageStyle(
                  message.message_type,
                  isOwnMessage
                )}`}
              >
                {isSystemMessage ? (
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-2 mb-1">
                      <RoleIcon className="w-4 h-4" />
                      {messageTypeLabel && (
                        <Badge className="text-xs px-2 py-0.5 bg-white/10 text-white/80 border-white/20">
                          {messageTypeLabel}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm font-medium">{message.content}</div>
                    <div className="text-xs opacity-60 mt-1">
                      {formatTime(message.created_at)}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* User Message Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={message.profiles.avatar_url} />
                          <AvatarFallback className="bg-[#20808D]/20 text-[#20808D] text-xs">
                            {message.profiles.full_name
                              ?.charAt(0)
                              ?.toUpperCase() || "?"}
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
                    <div className="text-sm leading-relaxed break-words">
                      {message.content}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-center px-4">
            <MessageSquare className="w-12 h-12 mb-3 text-white/20" />
            <p className="text-white/40 font-medium">No messages yet</p>
            <p className="text-sm text-white/30">
              Chat with participants during the debate
            </p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-[#20808D]/30 bg-[#091717]/50">
        <form onSubmit={handleSendMessage} className="space-y-3">
          <div className="flex space-x-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-[#091717]/60 border-[#20808D]/30 text-white placeholder:text-white/60 focus:border-[#20808D] rounded-lg text-sm"
              disabled={sending}
              maxLength={500}
            />
            <Button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="bg-[#20808D] hover:bg-[#20808D]/90 text-white px-3 rounded-lg transition-all duration-300 disabled:opacity-50"
            >
              {sending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>

          <div className="flex items-center justify-between text-xs text-white/50">
            <div className="flex items-center space-x-2">
              <Info className="w-3 h-3" />
              <span>Messages are visible to all participants</span>
            </div>
            <span>{newMessage.length}/500</span>
          </div>
        </form>
      </div>
    </div>
  );
}
