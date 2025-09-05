// src/components/debate/JitsiMeetIntegration.tsx
"use client";

import { useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";

interface Participant {
  id: string;
  room_id: string;
  user_id: string;
  role: "host" | "debater" | "audience";
  status: "joined" | "ready" | "speaking" | "muted";
  joined_at: string;
  ready_at?: string;
  is_online: boolean;
  profiles: {
    full_name: string;
    avatar_url?: string;
  };
}

interface DebateState {
  phase: "opening" | "rebuttal" | "closing" | "completed";
  current_speaker_id?: string;
  turn_start_time?: string;
  round_number: number;
  speaking_order: string[];
}

interface JitsiMeetIntegrationProps {
  roomId: string;
  roomName: string;
  userDisplayName: string;
  participants: Participant[];
  debateState: DebateState;
}

interface JitsiEvent {
  id?: string;
  from?: string;
  message?: DebateCommand;
}

interface DebateCommand {
  type: string;
  participantId?: string;
}

interface JitsiAPI {
  dispose: () => void;
  on: (event: string, callback: (data: JitsiEvent) => void) => void;
  executeCommand: (command: string, ...args: unknown[]) => void;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI: new (domain: string, options: unknown) => JitsiAPI;
  }
}

export default function JitsiMeetIntegration({
  roomId,
  userDisplayName,
  participants,
  debateState,
}: JitsiMeetIntegrationProps) {
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const jitsiAPI = useRef<JitsiAPI | null>(null);

  // Load Jitsi Meet External API
  const initializeJitsi = useCallback(() => {
    if (!jitsiContainerRef.current || !window.JitsiMeetExternalAPI) return;

    console.log("🎥 Initializing Jitsi Meet conference...");
    const domain = "meet.jit.si"; // Using the main Jitsi domain for better reliability
    const options = {
      roomName: `discourse-debate-${roomId}`,
      width: "100%",
      height: "100%",
      parentNode: jitsiContainerRef.current,
      userInfo: {
        displayName: userDisplayName,
      },
      configOverwrite: {
        startWithAudioMuted: false, // Start with audio unmuted for easier testing
        startWithVideoMuted: true, // Start with video muted to focus on audio first
        requireDisplayName: true,
        prejoinPageEnabled: false,
        disableInviteFunctions: true,
        disableAddingParticipants: true,
        disableRemoveParticipants: false,
        enableWelcomePage: false,
        enableClosePage: false,
        defaultLanguage: "en",
        disableProfile: true,
        disableDeepLinking: true,
        notificationTimeoutType: "long",
        // Performance optimizations for low-end devices
        resolution: 180, // Lower resolution for better performance
        constraints: {
          video: {
            height: { ideal: 180, max: 240 },
          },
        },
        disableSimulcast: true, // Reduce bandwidth usage
        p2p: { enabled: true }, // Use peer-to-peer for better performance
        // Debate-specific configurations
        toolbarButtons: ["microphone", "camera", "hangup", "settings"],
        // Disable features not needed for debates
        disableLobby: true,
        disableModeratorIndicator: false,
        disableReactions: true,
        disableSelfView: false,
        hideDisplayName: false,
      },
      interfaceConfigOverwrite: {
        DISABLE_VIDEO_BACKGROUND: true, // Disable backgrounds to save resources
        DISABLE_BLUR: true,
        VIDEO_LAYOUT_FIT: "both",
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        SHOW_BRAND_WATERMARK: false,
        BRAND_WATERMARK_LINK: "",
        SHOW_POWERED_BY: false,
        DEFAULT_BACKGROUND: "#091717",
        DEFAULT_WELCOME_PAGE_LOGO_URL: "",
        DEFAULT_LOGO_URL: "",
        MOBILE_APP_PROMO: false,
        // Customize UI for debate
        TOOLBAR_ALWAYS_VISIBLE: true,
        SETTINGS_SECTIONS: [
          "devices",
          "language",
          "moderator",
          "profile",
          "calendar",
          "sounds",
        ],
        RECENT_LIST_ENABLED: false,
        // Performance settings
        DISABLE_PRESENCE_STATUS: true,
        DISABLE_RINGING: true,
      },
    };

    try {
      jitsiAPI.current = new window.JitsiMeetExternalAPI(domain, options);

      // Event listeners for Jitsi Meet events
      jitsiAPI.current.on("ready", () => {
        console.log("✅ Jitsi Meet is ready for audio streaming");

        // Custom styling
        const iframe = jitsiContainerRef.current?.querySelector("iframe");
        if (iframe) {
          iframe.style.borderRadius = "12px";
          iframe.style.overflow = "hidden";
        }
      });

      jitsiAPI.current.on("participantJoined", (participant: JitsiEvent) => {
        console.log("👤 Participant joined:", participant);
      });

      jitsiAPI.current.on("participantLeft", (participant: JitsiEvent) => {
        console.log("👋 Participant left:", participant);
      });

      jitsiAPI.current.on("audioMuteStatusChanged", (event: JitsiEvent) => {
        console.log("🎤 Audio mute status changed:", event);
      });

      jitsiAPI.current.on("videoMuteStatusChanged", (event: JitsiEvent) => {
        console.log("📹 Video mute status changed:", event);
      });

      // Custom commands for debate control
      jitsiAPI.current.on("incomingMessage", (event: JitsiEvent) => {
        if (event.from === "debate-controller" && event.message) {
          handleDebateCommand(event.message);
        }
      });
    } catch (error) {
      console.error("❌ Failed to initialize Jitsi Meet:", error);
    }
  }, [roomId, userDisplayName]);

  useEffect(() => {
    // Load Jitsi Meet External API
    console.log("🎥 Initializing Jitsi Meet integration...");

    if (!window.JitsiMeetExternalAPI) {
      console.log("📡 Loading Jitsi Meet External API script...");
      const script = document.createElement("script");
      script.src = "https://meet.jit.si/libs/external_api.min.js"; // Using main Jitsi domain
      script.async = true;
      script.onload = () => {
        console.log("✅ Jitsi Meet External API loaded successfully");
        initializeJitsi();
      };
      script.onerror = (error) => {
        console.error("❌ Failed to load Jitsi Meet External API:", error);
      };
      document.head.appendChild(script);
    } else {
      console.log("✅ Jitsi Meet External API already available");
      initializeJitsi();
    }

    return () => {
      // Cleanup Jitsi API
      if (jitsiAPI.current) {
        console.log("🧹 Cleaning up Jitsi API...");
        jitsiAPI.current.dispose();
        jitsiAPI.current = null;
      }
    };
  }, [initializeJitsi]);

  const handleDebateCommand = (command: DebateCommand) => {
    if (!jitsiAPI.current) return;

    switch (command.type) {
      case "mute_participant":
        if (command.participantId) {
          jitsiAPI.current.executeCommand("muteEveryone");
        }
        break;
      case "spotlight_speaker":
        if (command.participantId) {
          // Custom logic to highlight current speaker
          console.log("Spotlighting speaker:", command.participantId);
        }
        break;
      default:
        break;
    }
  };

  // Update Jitsi based on debate state
  useEffect(() => {
    if (!jitsiAPI.current) return;

    // Send debate state updates to Jitsi
    const currentSpeaker = participants.find(
      (p) => p.user_id === debateState.current_speaker_id
    );
    if (currentSpeaker) {
      jitsiAPI.current.executeCommand("sendChatMessage", {
        displayName: "Debate System",
        message: `🎤 ${currentSpeaker.profiles.full_name} is now speaking`,
      });
    }
  }, [debateState.current_speaker_id, participants]);

  return (
    <div className="relative w-full h-full">
      {/* Loading State */}
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: jitsiAPI.current ? 0 : 1 }}
        transition={{ duration: 0.5 }}
        className="absolute inset-0 flex items-center justify-center bg-[#091717] z-10"
        style={{
          pointerEvents: jitsiAPI.current ? "none" : "auto",
          display: jitsiAPI.current ? "none" : "flex",
        }}
      >
        <div className="space-y-4 text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-4 border-[#20808D] border-t-transparent rounded-full mx-auto"
          />
          <div>
            <h3 className="text-lg font-semibold text-white">
              Connecting to audio call...
            </h3>
            <p className="mt-2 text-sm text-white/60">
              Setting up secure audio connection
            </p>
            <p className="mt-1 text-xs text-white/40">
              Grant microphone permission when prompted
            </p>
          </div>
        </div>
      </motion.div>

      {/* Jitsi Meet Container */}
      <div
        ref={jitsiContainerRef}
        className="w-full h-full rounded-lg overflow-hidden border border-[#20808D]/20"
        style={{ minHeight: "400px" }}
      />

      {/* Debate Status Overlay */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute z-20 top-4 left-4"
      >
        <div className="bg-[#091717]/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-[#20808D]/30">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-[#20808D] rounded-full animate-pulse"></div>
              <span className="text-sm font-semibold text-white/90">
                Phase:{" "}
                {debateState.phase.charAt(0).toUpperCase() +
                  debateState.phase.slice(1)}
              </span>
            </div>

            <div className="w-px h-4 bg-[#20808D]/30"></div>

            <div className="flex items-center space-x-2">
              <span className="text-sm text-white/70">
                Round {debateState.round_number}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Current Speaker Indicator */}
      {debateState.current_speaker_id && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute z-20 top-4 right-4"
        >
          <div className="px-4 py-2 border rounded-lg bg-green-500/20 backdrop-blur-sm border-green-500/40">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-semibold text-green-400">
                {
                  participants.find(
                    (p) => p.user_id === debateState.current_speaker_id
                  )?.profiles.full_name
                }{" "}
                Speaking
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Participant Count */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute z-20 bottom-4 left-4"
      >
        <div className="bg-[#091717]/90 backdrop-blur-sm rounded-lg px-3 py-2 border border-[#20808D]/30">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-[#20808D] rounded-full"></div>
            <span className="text-sm font-medium text-white/90">
              {participants.length} Participants
            </span>
          </div>
        </div>
      </motion.div>

      {/* Connection Quality Indicator */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute z-20 bottom-4 right-4"
      >
        <div className="bg-[#091717]/90 backdrop-blur-sm rounded-lg px-3 py-2 border border-[#20808D]/30">
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">
              <div className="w-1 h-3 bg-green-500 rounded-full"></div>
              <div className="w-1 h-4 bg-green-500 rounded-full"></div>
              <div className="w-1 h-3 rounded-full bg-green-500/50"></div>
            </div>
            <span className="text-sm font-medium text-green-400">Good</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
