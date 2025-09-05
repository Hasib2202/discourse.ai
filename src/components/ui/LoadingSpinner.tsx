// src/components/ui/LoadingSpinner.tsx
"use client";

import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps {
  text?: string;
}

export default function LoadingSpinner({
  text = "Loading...",
}: LoadingSpinnerProps) {
  // Pre-defined positions and timings to avoid hydration mismatch
  const backgroundDots = [
    { left: 15.2, top: 23.4, duration: 4.5, delay: 0.3 },
    { left: 78.6, top: 12.8, duration: 5.2, delay: 1.1 },
    { left: 32.1, top: 67.9, duration: 3.8, delay: 0.7 },
    { left: 89.4, top: 45.3, duration: 4.1, delay: 1.8 },
    { left: 6.7, top: 78.2, duration: 5.5, delay: 0.2 },
    { left: 54.8, top: 91.6, duration: 3.9, delay: 1.4 },
    { left: 43.2, top: 8.7, duration: 4.7, delay: 0.9 },
    { left: 91.3, top: 76.1, duration: 4.3, delay: 1.6 },
    { left: 12.9, top: 54.8, duration: 5.1, delay: 0.5 },
    { left: 67.5, top: 29.3, duration: 3.6, delay: 1.2 },
    { left: 25.7, top: 83.4, duration: 4.9, delay: 0.8 },
    { left: 82.1, top: 18.7, duration: 4.2, delay: 1.5 },
    { left: 38.9, top: 62.5, duration: 5.3, delay: 0.4 },
    { left: 71.4, top: 41.2, duration: 3.7, delay: 1.7 },
    { left: 9.2, top: 95.6, duration: 4.8, delay: 0.6 },
    { left: 56.3, top: 15.9, duration: 4.4, delay: 1.3 },
    { left: 94.7, top: 69.8, duration: 5.4, delay: 0.1 },
    { left: 21.6, top: 37.1, duration: 4.6, delay: 1.9 },
    { left: 76.8, top: 84.3, duration: 3.5, delay: 1.0 },
    { left: 45.1, top: 52.7, duration: 5.0, delay: 0.7 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#091717] via-[#13343B] to-[#2E565E] flex items-center justify-center">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {backgroundDots.map((dot, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-[#20808D]/20 rounded-full"
            style={{
              left: `${dot.left}%`,
              top: `${dot.top}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0, 1, 0],
              scale: [0, 1, 0],
            }}
            transition={{
              duration: dot.duration,
              repeat: Infinity,
              delay: dot.delay,
            }}
          />
        ))}
      </div>

      {/* Loading Content */}
      <div className="relative z-10 flex flex-col items-center space-y-6">
        {/* Animated Logo/Icon Area */}
        <motion.div
          className="relative"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.6, type: "spring" }}
        >
          <div className="relative">
            {/* Outer Ring */}
            <motion.div
              className="w-20 h-20 rounded-full border-4 border-[#20808D]/20"
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />

            {/* Inner Ring */}
            <motion.div
              className="absolute inset-2 w-16 h-16 rounded-full border-4 border-t-[#20808D] border-r-transparent border-b-transparent border-l-transparent"
              animate={{ rotate: -360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            />

            {/* Center Icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                animate={{
                  scale: [1, 1.1, 1],
                  opacity: [0.7, 1, 0.7],
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Loader2 className="w-8 h-8 text-[#20808D]" />
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Loading Text */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="space-y-2 text-center"
        >
          <h2 className="text-2xl font-bold text-white">{text}</h2>

          {/* Animated Dots */}
          <div className="flex items-center justify-center space-x-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 bg-[#20808D] rounded-full"
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              />
            ))}
          </div>
        </motion.div>

        {/* Progress Bar */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: "200px" }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="h-1 bg-[#20808D]/20 rounded-full overflow-hidden"
        >
          <motion.div
            className="h-full bg-gradient-to-r from-[#20808D] to-[#2E565E] rounded-full"
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      </div>
    </div>
  );
}
