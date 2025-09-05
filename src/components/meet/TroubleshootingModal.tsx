// src/components/meet/TroubleshootingModal.tsx
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Copy,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

interface BrowserInfo {
  name: string;
  version: string;
  supported: boolean;
}

interface DeviceInfo {
  hasMediaDevices: boolean;
  hasAudioContext: boolean;
  hasWebSocket: boolean;
  isHTTPS: boolean;
  userAgent: string;
  browser: BrowserInfo;
  isMobile: boolean;
  isIOS: boolean;
}

interface TroubleshootingModalProps {
  isOpen: boolean;
  onClose: () => void;
  compatibility: {
    isCompatible: boolean;
    issues: string[];
  };
}

export default function TroubleshootingModal({
  isOpen,
  onClose,
  compatibility,
}: TroubleshootingModalProps) {
  const [deviceInfo] = useState<DeviceInfo>(() => {
    if (typeof window === "undefined") {
      return {
        hasMediaDevices: false,
        hasAudioContext: false,
        hasWebSocket: false,
        isHTTPS: false,
        userAgent: "",
        browser: { name: "Unknown", version: "Unknown", supported: false },
        isMobile: false,
        isIOS: false,
      };
    }

    const detectBrowser = (): BrowserInfo => {
      const ua = window.navigator.userAgent;
      let name = "Unknown";
      let version = "Unknown";
      let supported = false;

      if (ua.includes("Chrome") && !ua.includes("Edg")) {
        name = "Chrome";
        const match = ua.match(/Chrome\/(\d+)/);
        version = match ? match[1] : "Unknown";
        supported = parseInt(version) >= 66;
      } else if (ua.includes("Firefox")) {
        name = "Firefox";
        const match = ua.match(/Firefox\/(\d+)/);
        version = match ? match[1] : "Unknown";
        supported = parseInt(version) >= 60;
      } else if (ua.includes("Safari") && !ua.includes("Chrome")) {
        name = "Safari";
        const match = ua.match(/Version\/(\d+)/);
        version = match ? match[1] : "Unknown";
        supported = parseInt(version) >= 12;
      } else if (ua.includes("Edg")) {
        name = "Edge";
        const match = ua.match(/Edg\/(\d+)/);
        version = match ? match[1] : "Unknown";
        supported = parseInt(version) >= 79;
      }

      return { name, version, supported };
    };

    return {
      hasMediaDevices: !!(
        navigator.mediaDevices && navigator.mediaDevices.getUserMedia
      ),
      hasAudioContext: !!(
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      ),
      hasWebSocket: !!window.WebSocket,
      isHTTPS:
        window.location.protocol === "https:" ||
        window.location.hostname === "localhost",
      userAgent: window.navigator.userAgent,
      browser: detectBrowser(),
      isMobile: /Mobi|Android/i.test(window.navigator.userAgent),
      isIOS: /iPad|iPhone|iPod/.test(window.navigator.userAgent),
    };
  });

  const runDiagnostics = async () => {
    try {
      // Test microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      toast.success("✅ Microphone test passed");
    } catch (error) {
      console.error("Microphone test failed:", error);
      toast.error("❌ Microphone test failed");
    }
  };

  const copyDebugInfo = () => {
    const debugInfo = {
      timestamp: new Date().toISOString(),
      compatibility,
      deviceInfo,
      url: window.location.href,
    };

    navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
    toast.success("Debug info copied to clipboard");
  };

  const troubleshootingSteps = [
    {
      title: "Check Browser Support",
      description: "Use Chrome 66+, Firefox 60+, Safari 12+, or Edge 79+",
      status: deviceInfo.browser.supported ? "success" : "error",
    },
    {
      title: "Enable HTTPS",
      description: "Microphone access requires a secure connection",
      status: deviceInfo.isHTTPS ? "success" : "error",
    },
    {
      title: "Allow Microphone Permission",
      description: "Click the microphone icon in your browser's address bar",
      status: deviceInfo.hasMediaDevices ? "success" : "error",
    },
    {
      title: "Check Audio Context",
      description: "Browser audio processing must be available",
      status: deviceInfo.hasAudioContext ? "success" : "error",
    },
    {
      title: "WebSocket Support",
      description: "Real-time communication support required",
      status: deviceInfo.hasWebSocket ? "success" : "error",
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <Card className="bg-[#1a1a1a]/95 backdrop-blur-sm border-[#20808D]/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2 text-white">
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                    <span>Meeting Troubleshooting</span>
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    className="text-white/60 hover:text-white"
                  >
                    ×
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Browser Info */}
                <div>
                  <h3 className="mb-3 text-lg font-semibold text-white">
                    Device Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-white/60">Browser:</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-white">
                          {deviceInfo.browser.name} {deviceInfo.browser.version}
                        </span>
                        <Badge
                          variant={
                            deviceInfo.browser.supported
                              ? "default"
                              : "destructive"
                          }
                          className="text-xs"
                        >
                          {deviceInfo.browser.supported
                            ? "Supported"
                            : "Unsupported"}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <span className="text-white/60">Connection:</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-white">
                          {deviceInfo.isHTTPS ? "HTTPS" : "HTTP"}
                        </span>
                        <Badge
                          variant={
                            deviceInfo.isHTTPS ? "default" : "destructive"
                          }
                          className="text-xs"
                        >
                          {deviceInfo.isHTTPS ? "Secure" : "Insecure"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Troubleshooting Steps */}
                <div>
                  <h3 className="mb-3 text-lg font-semibold text-white">
                    Troubleshooting Steps
                  </h3>
                  <div className="space-y-3">
                    {troubleshootingSteps.map((step, index) => (
                      <div
                        key={index}
                        className="flex items-start p-3 space-x-3 rounded-lg bg-white/5"
                      >
                        {step.status === "success" ? (
                          <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <h4 className="font-medium text-white">
                            {step.title}
                          </h4>
                          <p className="text-sm text-white/70">
                            {step.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Common Solutions */}
                <div>
                  <h3 className="mb-3 text-lg font-semibold text-white">
                    Common Solutions
                  </h3>
                  <div className="space-y-3">
                    <div className="space-y-2 text-sm text-white/80">
                      <div className="font-medium text-white">
                        General Solutions:
                      </div>
                      <div>• Refresh the page and try again</div>
                      <div>• Clear your browser cache and cookies</div>
                      <div>
                        • Disable browser extensions that might block media
                        access
                      </div>
                      <div>• Try opening in an incognito/private window</div>
                      <div>
                        • Check if other applications are using your microphone
                      </div>
                      <div>• Restart your browser</div>
                    </div>

                    <div className="space-y-2 text-sm text-white/80">
                      <div className="font-medium text-white">
                        Mobile-Specific Solutions:
                      </div>
                      <div>
                        • Ensure you&apos;re using HTTPS (secure connection)
                      </div>
                      <div>
                        • Update your mobile browser to the latest version
                      </div>
                      <div>• Try using Chrome or Safari mobile browsers</div>
                      <div>
                        • Check mobile browser permissions for microphone access
                      </div>
                      <div>
                        • Close other apps that might be using the microphone
                      </div>
                      <div>
                        • For iOS: Ensure Silent Mode is off and try interacting
                        with the page first
                      </div>
                      <div>
                        • For Android: Check app permissions in Settings &gt;
                        Apps &gt; Browser &gt; Permissions
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={runDiagnostics}
                    className="bg-[#20808D] hover:bg-[#20808D]/90 text-white"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Run Diagnostics
                  </Button>
                  <Button
                    onClick={copyDebugInfo}
                    variant="outline"
                    className="border-[#20808D]/40 text-white hover:bg-[#20808D]/10"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Debug Info
                  </Button>
                  <Button
                    onClick={() =>
                      window.open(
                        "https://support.google.com/chrome/answer/2693767",
                        "_blank"
                      )
                    }
                    variant="outline"
                    className="border-[#20808D]/40 text-white hover:bg-[#20808D]/10"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Browser Help
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
