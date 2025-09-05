// src/components/debug/AudioDebugPanel.tsx
"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, MicOff, Settings } from "lucide-react";

interface AudioDebugPanelProps {
  show: boolean;
  onToggle: () => void;
}

export default function AudioDebugPanel({
  show,
  onToggle,
}: AudioDebugPanelProps) {
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [permissionStatus, setPermissionStatus] = useState<
    "granted" | "denied" | "prompt"
  >("prompt");
  const [jitsiStatus, setJitsiStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [audioLevel, setAudioLevel] = useState(0);

  useEffect(() => {
    // Check Jitsi status
    const checkJitsi = () => {
      if (window.JitsiMeetExternalAPI) {
        setJitsiStatus("ready");
      } else {
        setJitsiStatus("loading");
      }
    };

    // Check audio permissions
    const checkPermissions = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        setPermissionStatus("granted");

        // Get audio devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(
          (device) => device.kind === "audioinput"
        );
        setAudioDevices(audioInputs);

        // Stop the test stream
        stream.getTracks().forEach((track) => track.stop());
      } catch (error) {
        setPermissionStatus("denied");
        console.error("Audio permission denied:", error);
      }
    };

    if (show) {
      checkJitsi();
      checkPermissions();
    }
  }, [show]);

  const testAudioPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermissionStatus("granted");

      // Simulate audio level monitoring
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateAudioLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(average);
      };

      const interval = setInterval(updateAudioLevel, 100);

      setTimeout(() => {
        clearInterval(interval);
        stream.getTracks().forEach((track) => track.stop());
        audioContext.close();
        setAudioLevel(0);
      }, 5000);
    } catch (error) {
      setPermissionStatus("denied");
      console.error("Audio test failed:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "granted":
      case "ready":
        return "bg-green-500";
      case "denied":
      case "error":
        return "bg-red-500";
      default:
        return "bg-yellow-500";
    }
  };

  if (!show) {
    return (
      <Button
        onClick={onToggle}
        variant="outline"
        size="sm"
        className="fixed bottom-4 left-4 z-50 bg-[#091717]/90 border-[#20808D]/30 text-white hover:bg-[#20808D]/20"
      >
        <Settings className="w-4 h-4 mr-2" />
        Audio Debug
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 left-4 z-50 w-80 bg-[#091717]/95 border-[#20808D]/30 text-white">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-[#20808D]">Audio Debug Panel</h3>
          <Button
            onClick={onToggle}
            variant="ghost"
            size="sm"
            className="text-white/60 hover:text-white"
          >
            ×
          </Button>
        </div>

        {/* Jitsi Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">Jitsi API Status:</span>
            <Badge
              className={`${getStatusColor(
                jitsiStatus
              )} text-white border-none`}
            >
              {jitsiStatus}
            </Badge>
          </div>
          <div className="text-xs text-white/60">
            {jitsiStatus === "ready"
              ? "✅ Jitsi Meet API loaded successfully"
              : "⏳ Loading Jitsi Meet API..."}
          </div>
        </div>

        {/* Audio Permission Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">Microphone Access:</span>
            <Badge
              className={`${getStatusColor(
                permissionStatus
              )} text-white border-none`}
            >
              {permissionStatus}
            </Badge>
          </div>
          <div className="text-xs text-white/60">
            {permissionStatus === "granted"
              ? "✅ Microphone permission granted"
              : permissionStatus === "denied"
              ? "❌ Microphone permission denied"
              : "⚠️ Microphone permission pending"}
          </div>
        </div>

        {/* Audio Devices */}
        <div className="space-y-2">
          <span className="text-sm">Audio Devices:</span>
          <div className="max-h-20 overflow-y-auto">
            {audioDevices.length > 0 ? (
              audioDevices.map((device, index) => (
                <div
                  key={device.deviceId}
                  className="text-xs text-white/60 truncate"
                >
                  <Mic className="w-3 h-3 inline mr-1" />
                  {device.label || `Microphone ${index + 1}`}
                </div>
              ))
            ) : (
              <div className="text-xs text-white/60">
                No audio devices detected
              </div>
            )}
          </div>
        </div>

        {/* Audio Level Indicator */}
        {audioLevel > 0 && (
          <div className="space-y-2">
            <span className="text-sm">Audio Level:</span>
            <div className="w-full bg-[#20808D]/20 rounded-full h-2">
              <div
                className="bg-[#20808D] h-2 rounded-full transition-all duration-100"
                style={{ width: `${Math.min(audioLevel * 2, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Test Button */}
        <Button
          onClick={testAudioPermission}
          className="w-full bg-[#20808D] hover:bg-[#20808D]/90"
          disabled={permissionStatus === "granted"}
        >
          {permissionStatus === "granted" ? (
            <>
              <Mic className="w-4 h-4 mr-2" />
              Test Audio (5s)
            </>
          ) : (
            <>
              <MicOff className="w-4 h-4 mr-2" />
              Request Audio Access
            </>
          )}
        </Button>

        {/* Quick Tips */}
        <div className="text-xs text-white/50 space-y-1">
          <div>💡 Tips for audio testing:</div>
          <div>• Use headphones to prevent echo</div>
          <div>• Test with multiple browsers</div>
          <div>• Check system audio settings</div>
          <div>• Ensure stable internet connection</div>
        </div>
      </div>
    </Card>
  );
}
