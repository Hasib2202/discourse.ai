"use client";

import { Button } from "@/components/ui/button";
import { MessageSquare, ArrowRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

export default function Navbar() {
  const [scrollY, setScrollY] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const navStyle = {
    background: `linear-gradient(135deg, rgba(4, 4, 4, 0.95) 0%, rgba(2, 189, 155, 0.05) 50%, rgba(4, 4, 4, 0.95) 100%)`,
    borderBottom: `1px solid rgba(2, 189, 155, ${Math.min(scrollY * 0.01, 0.3)})`,
    boxShadow: `0 8px 32px rgba(2, 189, 155, ${Math.min(scrollY * 0.005, 0.2)})`,
  };

  const navItems = ["Features", "Modes", "Pricing", "About"];

  return (
    <>
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, type: "spring" }}
        className="fixed top-0 left-0 right-0 z-50 backdrop-blur-2xl"
        style={navStyle}
      >
        <div className="px-4 mx-auto sm:px-6 lg:px-6 max-w-7xl">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/" className="flex items-center space-x-4">
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#02BD9B] to-[#02BD9B]/70 rounded-2xl blur-lg opacity-50 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-[#02BD9B] to-[#02BD9B]/80 rounded-2xl flex items-center justify-center shadow-2xl border border-[#02BD9B]/20">
                    <MessageSquare className="w-5 h-5 text-white sm:w-6 sm:h-6" />
                  </div>
                </div>
                <span className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-white via-[#02BD9B] to-white bg-clip-text text-transparent">
                  Discourse
                </span>
              </Link>
            </div>

            {/* Desktop links */}
            <div className="items-center hidden lg:flex lg:space-x-10">
              {navItems.map((item, index) => (
                <motion.div
                  key={item}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 + 0.2 }}
                >
                  <Link
                    href={`#${item.toLowerCase()}`}
                    className="relative text-white/80 hover:text-[#02BD9B] transition-colors duration-300 font-medium group"
                  >
                    {item}
                    <div className="absolute -bottom-2 left-0 w-0 h-0.5 bg-gradient-to-r from-[#02BD9B] to-[#02BD9B]/70 group-hover:w-full transition-all duration-300 rounded-full"></div>
                    <div className="absolute -bottom-2 left-0 w-0 h-0.5 bg-white/30 group-hover:w-full transition-all duration-500 delay-100 rounded-full"></div>
                  </Link>
                </motion.div>
              ))}
            </div>

            {/* Actions + Mobile Hamburger */}
            <div className="flex items-center gap-2">
              {/* Desktop actions */}
              <div className="items-center hidden space-x-4 lg:flex">
                <Link href="/login">
                  <Button
                    variant="ghost"
                    className="text-white hover:text-[#02BD9B] hover:bg-[#02BD9B]/10 backdrop-blur-sm transition-all duration-300 border border-transparent hover:border-[#02BD9B]/30"
                  >
                    Sign In
                  </Button>
                </Link>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button className="bg-gradient-to-r from-[#02BD9B] to-[#02BD9B]/80 hover:from-[#02BD9B]/90 hover:to-[#02BD9B]/70 text-[#040404] font-semibold px-6 py-2 shadow-xl shadow-[#02BD9B]/30 border border-[#02BD9B]/20 backdrop-blur-sm">
                    Get Started
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </motion.div>
              </div>

              {/* Mobile hamburger */}
              <div className="lg:hidden">
                <button
                  aria-label={mobileOpen ? "Close menu" : "Open menu"}
                  aria-expanded={mobileOpen}
                  onClick={() => setMobileOpen((s) => !s)}
                  className="p-2 rounded-md text-white/90 hover:text-[#02BD9B] focus:outline-none focus:ring-2 focus:ring-[#02BD9B]/40"
                >
                  {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Mobile menu overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="mobile-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 lg:hidden"
          >
            {/* backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.45 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 bg-black"
              onClick={() => setMobileOpen(false)}
              aria-hidden
            />

            {/* sliding panel */}
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute right-0 top-0 h-full w-full max-w-xs sm:max-w-sm bg-gradient-to-b from-[#040404] to-[#0b0b0b] backdrop-blur-md p-6 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <Link href="/" onClick={() => setMobileOpen(false)} className="flex items-center space-x-3">
                  <div className="relative w-10 h-10 bg-gradient-to-br from-[#02BD9B] to-[#02BD9B]/80 rounded-xl flex items-center justify-center shadow-md border border-[#02BD9B]/20">
                    <MessageSquare className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-lg font-bold text-white">Discourse</span>
                </Link>
                <button
                  aria-label="Close menu"
                  onClick={() => setMobileOpen(false)}
                  className="p-2 rounded-md text-white/90 hover:text-[#02BD9B] focus:outline-none focus:ring-2 focus:ring-[#02BD9B]/40"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <nav className="flex flex-col gap-4">
                {navItems.map((item) => (
                  <Link
                    key={item}
                    href={`#${item.toLowerCase()}`}
                    onClick={() => setMobileOpen(false)}
                    className="block text-white/90 font-medium py-2 px-1 rounded-md hover:text-[#02BD9B] transition-colors"
                  >
                    {item}
                  </Link>
                ))}
              </nav>

              <div className="pt-6 mt-6 border-t border-white/6">
                <Link href="/login" onClick={() => setMobileOpen(false)}>
                  <Button
                    variant="ghost"
                    className="w-full text-white/90 justify-center hover:text-[#02BD9B] hover:bg-[#02BD9B]/6"
                  >
                    Sign In
                  </Button>
                </Link>

                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="mt-3">
                  <Button
                    onClick={() => setMobileOpen(false)}
                    className="w-full bg-gradient-to-r from-[#02BD9B] to-[#02BD9B]/80 text-[#040404] font-semibold px-4 py-2 shadow-md border border-[#02BD9B]/20"
                  >
                    Get Started
n                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </motion.div>

                <p className="mt-4 text-sm text-white/60">© {new Date().getFullYear()} Discourse</p>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* spacer so page content isn't hidden under fixed nav */}
      <div className="h-20" />
    </>
  );
}
