"use client";

import { Button } from "@/components/ui/button";
import { MessageSquare, ArrowRight } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";

export default function Navbar() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navStyle = {
    background: `linear-gradient(135deg, rgba(9, 23, 23, 0.8) 0%, rgba(19, 52, 59, 0.6) 50%, rgba(9, 23, 23, 0.8) 100%)`,
    borderBottom: `1px solid rgba(32, 128, 141, ${Math.min(
      scrollY * 0.01,
      0.3
    )})`,
    boxShadow: `0 8px 32px rgba(32, 128, 141, ${Math.min(
      scrollY * 0.005,
      0.2
    )})`,
  };

  return (
    <motion.nav
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, type: "spring" }}
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-2xl"
      style={navStyle}
    >
      <div className="px-6 mx-auto max-w-7xl">
        <div className="flex items-center justify-between h-20">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link href="/" className="flex items-center space-x-4">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-[#20808D] to-[#2E565E] rounded-2xl blur-lg opacity-50 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative w-12 h-12 bg-gradient-to-br from-[#20808D] to-[#2E565E] rounded-2xl flex items-center justify-center shadow-2xl border border-white/10">
                  <MessageSquare className="w-6 h-6 text-white" />
                </div>
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-white via-[#20808D] to-white bg-clip-text text-transparent">
                Discourse
              </span>
            </Link>
          </motion.div>

          <div className="items-center hidden space-x-10 lg:flex">
            {["Features", "Modes", "Pricing", "About"].map((item, index) => (
              <motion.div
                key={item}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 + 0.5 }}
              >
                <Link
                  href={`#${item.toLowerCase()}`}
                  className="relative text-white/80 hover:text-[#20808D] transition-colors duration-300 font-medium group"
                >
                  {item}
                  <div className="absolute -bottom-2 left-0 w-0 h-0.5 bg-gradient-to-r from-[#20808D] to-[#2E565E] group-hover:w-full transition-all duration-300 rounded-full"></div>
                  <div className="absolute -bottom-2 left-0 w-0 h-0.5 bg-white/30 group-hover:w-full transition-all duration-500 delay-100 rounded-full"></div>
                </Link>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 }}
            className="flex items-center space-x-4"
          >
            <Link href="/login">
              <Button
                variant="ghost"
                className="text-white hover:text-[#20808D] hover:bg-[#20808D]/10 backdrop-blur-sm transition-all duration-300 border border-transparent hover:border-[#20808D]/30"
              >
                Sign In
              </Button>
            </Link>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button className="bg-gradient-to-r from-[#20808D] to-[#2E565E] hover:from-[#20808D]/90 hover:to-[#2E565E]/90 text-white px-6 py-2 shadow-xl shadow-[#20808D]/30 border border-white/10 backdrop-blur-sm">
                Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </motion.nav>
  );
}
