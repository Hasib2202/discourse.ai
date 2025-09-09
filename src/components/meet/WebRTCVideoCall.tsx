// components/meet/WebRTCVideoCall.tsx
"use client";

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Phone, 
  PhoneOff, 
  Monitor, 
  MonitorOff,
  Hand,
  MessageSquare,
  Users,
  Settings,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useWebRTC, Participant } from '@/hooks/useWebRTC';
import { toast } from 'sonner';

interface WebRTCVideoCallProps {
  roomId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  isHost?: boolean;
  onLeaveCall?: () => void;
}

interface VideoTileProps {
  participant: Participant;
  isLocal?: boolean;
  isMainView?: boolean;
  onToggleMainView?: () => void;
}

const VideoTile: React.FC<VideoTileProps> = ({ 
  participant, 
  isLocal = false, 
  isMainView = false,
  onToggleMainView 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream]);

  const initials = participant.userName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <motion.div
      layout
      className={`relative overflow-hidden rounded-xl border-2 transition-all duration-300 ${
        isMainView 
          ? 'border-[#02BD9B] shadow-2xl shadow-[#02BD9B]/20' 
          : 'border-[#02BD9B]/30 hover:border-[#02BD9B]/60'
      } ${isLocal ? 'bg-gradient-to-br from-[#040404]/90 to-[#02BD9B]/10' : 'bg-[#040404]/80'}`}
      style={{ 
        height: isMainView ? '400px' : '200px',
        aspectRatio: '16/9'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onToggleMainView}
      whileHover={{ scale: isMainView ? 1 : 1.02 }}
    >
      {/* Video Stream */}
      {participant.stream && !participant.isVideoOff ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`absolute inset-0 w-full h-full object-cover ${
            isLocal ? 'scale-x-[-1]' : ''
          }`}
        />
      ) : (
        // Avatar when video is off
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`${
            isMainView ? 'w-24 h-24' : 'w-16 h-16'
          } bg-gradient-to-br from-[#02BD9B]/30 to-[#02BD9B]/10 rounded-full flex items-center justify-center border-2 border-[#02BD9B]/40`}>
            <span className={`${
              isMainView ? 'text-2xl' : 'text-lg'
            } font-bold text-[#02BD9B]`}>
              {initials}
            </span>
          </div>
        </div>
      )}

      {/* Overlay Controls */}
      <AnimatePresence>
        {(isHovered || isMainView) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
          >
            {/* Top Overlay - User Info */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Badge className={`${
                  isLocal 
                    ? 'bg-[#02BD9B]/80 text-[#040404]' 
                    : 'bg-[#040404]/80 text-white border-[#02BD9B]/40'
                } text-xs font-semibold`}>
                  {participant.userName} {isLocal && '(You)'}
                </Badge>
                
                {participant.isHandRaised && (
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
                  >
                    <Hand className="w-4 h-4 text-yellow-400" />
                  </motion.div>
                )}
              </div>

              {!isMainView && onToggleMainView && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleMainView();
                  }}
                  className="h-6 w-6 p-0 hover:bg-[#02BD9B]/20"
                >
                  <Maximize2 className="w-3 h-3 text-white" />
                </Button>
              )}
            </div>

            {/* Bottom Overlay - Status Icons */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {/* Audio Status */}
                <div className={`p-2 rounded-full ${
                  participant.isMuted 
                    ? 'bg-red-500/80' 
                    : 'bg-green-500/80'
                }`}>
                  {participant.isMuted ? (
                    <MicOff className="w-3 h-3 text-white" />
                  ) : (
                    <Mic className="w-3 h-3 text-white" />
                  )}
                </div>

                {/* Video Status */}
                <div className={`p-2 rounded-full ${
                  participant.isVideoOff 
                    ? 'bg-red-500/80' 
                    : 'bg-green-500/80'
                }`}>
                  {participant.isVideoOff ? (
                    <VideoOff className="w-3 h-3 text-white" />
                  ) : (
                    <Video className="w-3 h-3 text-white" />
                  )}
                </div>
              </div>

              {/* Speaking Indicator */}
              {participant.isSpeaking && (
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className="p-2 bg-[#02BD9B]/80 rounded-full"
                >
                  <Volume2 className="w-3 h-3 text-white" />
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connection Quality Indicator */}
      <div className="absolute top-3 right-3">
        <div className="flex space-x-1">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-1 h-3 rounded-full ${
                i <= 2 ? 'bg-green-400' : 'bg-gray-400'
              }`}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default function WebRTCVideoCall({
  roomId,
  userId,
  userName,
  userAvatar,
  isHost = false,
  onLeaveCall
}: WebRTCVideoCallProps) {
  const [isCallActive, setIsCallActive] = useState(false);
  const [mainViewUserId, setMainViewUserId] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const {
    localStream,
    participants,
    isMuted,
    isVideoOff,
    isScreenSharing,
    isConnecting,
    error,
    localVideoRef,
    joinCall,
    leaveCall,
    toggleMute,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    clearError
  } = useWebRTC({ roomId, userId, userName });

  // Handle join call
  const handleJoinCall = async () => {
    try {
      await joinCall(true, true);
      setIsCallActive(true);
      toast.success('Joined the video call!');
    } catch (error) {
      console.error('Failed to join call:', error);
      toast.error('Failed to join call. Please check your camera/microphone permissions.');
    }
  };

  // Handle leave call
  const handleLeaveCall = () => {
    leaveCall();
    setIsCallActive(false);
    toast.info('Left the video call');
    onLeaveCall?.();
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Handle screen sharing
  const handleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        await stopScreenShare();
        toast.info('Screen sharing stopped');
      } else {
        await startScreenShare();
        toast.success('Screen sharing started');
      }
    } catch (error) {
      toast.error('Failed to toggle screen sharing');
    }
  };

  // Clear errors when they occur
  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  // Get all participants including local user
  const allParticipants = React.useMemo(() => {
    const localParticipant: Participant = {
      userId,
      userName,
      stream: localStream,
      isMuted,
      isVideoOff,
      isHandRaised: false,
      isSpeaking: false
    };

    return new Map([
      [userId, localParticipant],
      ...participants
    ]);
  }, [userId, userName, localStream, isMuted, isVideoOff, participants]);

  // Get main view participant
  const mainParticipant = mainViewUserId 
    ? allParticipants.get(mainViewUserId)
    : allParticipants.get(userId); // Default to local user

  // Get grid participants (excluding main view)
  const gridParticipants = Array.from(allParticipants.values())
    .filter(p => p.userId !== mainViewUserId);

  if (!isCallActive) {
    return (
      <div className="flex flex-col items-center justify-center h-[600px] bg-gradient-to-br from-[#040404] to-[#02BD9B]/10 rounded-xl border border-[#02BD9B]/30">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center space-y-6"
        >
          <div className="w-20 h-20 bg-[#02BD9B]/20 rounded-full flex items-center justify-center mx-auto">
            <Video className="w-10 h-10 text-[#02BD9B]" />
          </div>
          
          <div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Ready to join the video call?
            </h3>
            <p className="text-white/70">
              Connect with other participants through video and audio
            </p>
          </div>

          <Button
            onClick={handleJoinCall}
            disabled={isConnecting}
            className="bg-gradient-to-r from-[#02BD9B] to-[#02BD9B]/80 hover:from-[#02BD9B]/90 hover:to-[#02BD9B]/70 text-[#040404] font-semibold px-8 py-3 text-lg"
          >
            {isConnecting ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-5 h-5 border-2 border-[#040404] border-t-transparent rounded-full mr-2"
                />
                Connecting...
              </>
            ) : (
              <>
                <Phone className="w-5 h-5 mr-2" />
                Join Video Call
              </>
            )}
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`w-full h-full ${isFullscreen ? 'fixed inset-0 z-50 bg-[#040404]' : ''}`}>
      <div className="grid grid-cols-12 gap-4 h-full">
        {/* Main Video Area */}
        <div className="col-span-9 space-y-4">
          {/* Main Video View */}
          {mainParticipant && (
            <div className="relative">
              <VideoTile
                participant={mainParticipant}
                isLocal={mainParticipant.userId === userId}
                isMainView={true}
              />
              
              {/* Local Video Overlay (Picture-in-Picture) */}
              {mainParticipant.userId !== userId && (
                <div className="absolute bottom-4 right-4 w-48">
                  <VideoTile
                    participant={allParticipants.get(userId)!}
                    isLocal={true}
                    onToggleMainView={() => setMainViewUserId(userId)}
                  />
                </div>
              )}
            </div>
          )}

          {/* Participants Grid */}
          {gridParticipants.length > 0 && (
            <div className={`grid gap-3 ${
              gridParticipants.length <= 2 ? 'grid-cols-2' : 
              gridParticipants.length <= 4 ? 'grid-cols-4' : 
              'grid-cols-6'
            }`}>
              {gridParticipants.map((participant) => (
                <VideoTile
                  key={participant.userId}
                  participant={participant}
                  isLocal={participant.userId === userId}
                  onToggleMainView={() => setMainViewUserId(participant.userId)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="col-span-3 space-y-4">
          {/* Participants List */}
          <Card className="border-0 bg-gradient-to-br from-[#040404]/80 to-[#02BD9B]/20 backdrop-blur-xl">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-white flex items-center">
                  <Users className="w-4 h-4 mr-2 text-[#02BD9B]" />
                  Participants ({allParticipants.size})
                </h3>
                {isHost && (
                  <Button size="sm" variant="ghost" className="text-[#02BD9B]">
                    <Settings className="w-4 h-4" />
                  </Button>
                )}
              </div>
              
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {Array.from(allParticipants.values()).map((participant) => (
                  <div
                    key={participant.userId}
                    className="flex items-center space-x-3 p-2 rounded-lg bg-[#040404]/40 border border-[#02BD9B]/20"
                  >
                    <div className="w-8 h-8 bg-[#02BD9B]/20 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-[#02BD9B]">
                        {participant.userName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">
                        {participant.userName} {participant.userId === userId && '(You)'}
                      </div>
                      <div className="flex items-center space-x-1">
                        {participant.isMuted ? (
                          <MicOff className="w-3 h-3 text-red-400" />
                        ) : (
                          <Mic className="w-3 h-3 text-green-400" />
                        )}
                        {participant.isVideoOff ? (
                          <VideoOff className="w-3 h-3 text-red-400" />
                        ) : (
                          <Video className="w-3 h-3 text-green-400" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Chat Toggle */}
          <Button
            onClick={() => setShowChat(!showChat)}
            variant="outline"
            className="w-full border-[#02BD9B]/30 text-white hover:bg-[#02BD9B]/20"
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            {showChat ? 'Hide Chat' : 'Show Chat'}
          </Button>
        </div>
      </div>

      {/* Bottom Control Bar */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
        <div className="flex items-center space-x-3 bg-[#040404]/95 backdrop-blur-xl border border-[#02BD9B]/30 rounded-2xl p-4 shadow-2xl">
          {/* Mute Toggle */}
          <Button
            onClick={toggleMute}
            size="lg"
            className={`rounded-xl ${
              isMuted 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-[#02BD9B]/20 hover:bg-[#02BD9B]/30 text-white border border-[#02BD9B]/40'
            }`}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </Button>

          {/* Video Toggle */}
          <Button
            onClick={toggleVideo}
            size="lg"
            className={`rounded-xl ${
              isVideoOff 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-[#02BD9B]/20 hover:bg-[#02BD9B]/30 text-white border border-[#02BD9B]/40'
            }`}
          >
            {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </Button>

          {/* Screen Share */}
          <Button
            onClick={handleScreenShare}
            size="lg"
            className={`rounded-xl ${
              isScreenSharing 
                ? 'bg-[#02BD9B] hover:bg-[#02BD9B]/90 text-[#040404]' 
                : 'bg-[#02BD9B]/20 hover:bg-[#02BD9B]/30 text-white border border-[#02BD9B]/40'
            }`}
          >
            {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
          </Button>

          {/* Fullscreen Toggle */}
          <Button
            onClick={toggleFullscreen}
            size="lg"
            className="rounded-xl bg-[#02BD9B]/20 hover:bg-[#02BD9B]/30 text-white border border-[#02BD9B]/40"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </Button>

          {/* Leave Call */}
          <Button
            onClick={handleLeaveCall}
            size="lg"
            className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
          >
            <PhoneOff className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Hidden local video element */}
      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        className="hidden"
      />
    </div>
  );
}