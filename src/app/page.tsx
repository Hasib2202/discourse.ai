"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  Users,
  Zap,
  Shield,
  Brain,
  Mic,
  ArrowRight,
  CheckCircle,
  Star,
  Play,
  Award,
  ChevronDown,
} from "lucide-react";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function LandingPage() {
  const heroRef = useRef(null);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const opacity = useTransform(scrollYProgress, [0, 1], [1, 0]);

  const marqueeItems = [
    "🚀 10K+ Active Debaters",
    "⚡ 98% AI Accuracy Rate",
    "🎯 Featured by TechCrunch",
    "🌟 Award Winner 2024",
    "💡 50K+ Debates Analyzed",
    "🔥 #1 Trending Platform",
    "✨ Industry Leader",
    "🎪 Live AI Moderation",
    "🧠 Neural Analysis",
    "⭐ 4.9/5 User Rating",
  ];

  const bgGridStyle = {
    backgroundImage: `linear-gradient(rgba(2, 189, 155, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(2, 189, 155, 0.3) 1px, transparent 1px)`,
    backgroundSize: "60px 60px",
  };

  const backgroundMeshStyle = {
    background: `radial-gradient(circle at 20% 80%, rgba(2, 189, 155, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(2, 189, 155, 0.08) 0%, transparent 50%), radial-gradient(circle at 40% 40%, rgba(2, 189, 155, 0.05) 0%, transparent 50%)`,
  };

  return (
    <div className="min-h-screen w-full bg-[#040404] overflow-x-hidden relative">
      {/* Floating Background Particles */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        {Array.from({ length: 100 }).map((_, i) => {
          // Generate deterministic positions based on index to avoid hydration mismatch
          const leftPos = (i * 37) % 100;
          const topPos = (i * 73) % 100;

          return (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-[#02BD9B]/20 rounded-full"
              style={{
                left: `${leftPos}%`,
                top: `${topPos}%`,
              }}
              animate={{
                y: [0, -30, 0],
                opacity: [0, 1, 0],
                scale: [0, 1, 0],
              }}
              transition={{
                duration: (i % 4) + 3, // Vary duration based on index
                repeat: Infinity,
                delay: (i % 20) * 0.1, // Stagger delays based on index
              }}
            />
          );
        })}
      </div>

      {/* Navigation */}
      <Navbar />

      {/* Hero Section */}
      <section
        ref={heroRef}
        className="relative flex items-center justify-center w-full min-h-screen pt-24 pb-16"
      >
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 opacity-30">
            <div className="absolute inset-0" style={backgroundMeshStyle} />
          </div>

          <motion.div
            className="absolute inset-0 opacity-10"
            animate={{ backgroundPosition: ["0% 0%", "100% 100%"] }}
            transition={{
              duration: 20,
              repeat: Infinity,
              repeatType: "reverse",
            }}
            style={bgGridStyle}
          />

          <motion.div
            style={{ y, opacity }}
            className="absolute top-1/4 left-1/4 w-72 h-72 bg-gradient-to-br from-[#02BD9B]/20 to-transparent rounded-full blur-3xl"
            animate={{
              rotate: 360,
              scale: [1, 1.2, 1],
            }}
            transition={{
              rotate: { duration: 30, repeat: Infinity, ease: "linear" },
              scale: { duration: 8, repeat: Infinity, ease: "easeInOut" },
            }}
          />
          <motion.div
            style={{
              y: useTransform(scrollYProgress, [0, 1], ["0%", "-40%"]),
              opacity,
            }}
            className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-gradient-to-br from-[#02BD9B]/15 to-transparent rounded-full blur-3xl"
            animate={{
              rotate: -360,
              scale: [1, 0.8, 1],
            }}
            transition={{
              rotate: { duration: 25, repeat: Infinity, ease: "linear" },
              scale: { duration: 6, repeat: Infinity, ease: "easeInOut" },
            }}
          />
        </div>

        <div className="relative z-10 max-w-5xl px-6 mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <motion.div
              animate={{
                boxShadow: [
                  "0 0 20px rgba(2, 189, 155, 0.3)",
                  "0 0 40px rgba(2, 189, 155, 0.6)",
                  "0 0 20px rgba(2, 189, 155, 0.3)",
                ],
              }}
              transition={{ duration: 3, repeat: Infinity }}
              className="inline-block"
            >
              <Badge className="border-2 border-[#02BD9B]/40 text-[#02BD9B] bg-gradient-to-r from-[#02BD9B]/10 to-[#02BD9B]/5 mb-0 px-6 py-2 backdrop-blur-xl shadow-2xl">
                AI-Powered Debate Platform
              </Badge>
            </motion.div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.4 }}
            className="px-4 mb-6 text-3xl font-bold leading-tight text-white sm:mb-8 sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl sm:px-0"
          >
            <motion.div
              initial={{ x: -100 }}
              animate={{ x: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              Transform Your
            </motion.div>
            <motion.div
              initial={{ x: 100 }}
              animate={{ x: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="bg-gradient-to-r from-[#02BD9B] via-white to-[#02BD9B] bg-clip-text text-transparent"
              style={{
                filter: "drop-shadow(0 4px 20px rgba(2, 189, 155, 0.3))",
              }}
            >
              Debate Skills
            </motion.div>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1 }}
            className="max-w-sm px-6 mx-auto mb-8 text-base leading-relaxed sm:max-w-2xl lg:max-w-3xl sm:px-4 lg:px-0 sm:mb-12 sm:text-lg lg:text-xl text-white/90"
          >
            Elevate your argumentation with cutting-edge AI analysis, real-time
            fact-checking, and structured feedback. Perfect for students,
            professionals, and debate enthusiasts.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.2 }}
            className="flex flex-col justify-center gap-6 mb-16 sm:flex-row"
          >
            <motion.div
              whileHover={{
                scale: 1.05,
                boxShadow: "0 20px 40px rgba(32, 128, 141, 0.4)",
              }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                size="lg"
                className="bg-gradient-to-r from-[#02BD9B] to-[#02BD9B]/80 hover:from-[#02BD9B]/90 hover:to-[#02BD9B]/70 text-[#040404] font-semibold px-10 py-4 text-lg shadow-2xl shadow-[#02BD9B]/30 border border-[#02BD9B]/20 backdrop-blur-sm"
              >
                Start Debating
                <motion.div
                  animate={{ x: [0, 4, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <ArrowRight className="w-5 h-5 ml-2" />
                </motion.div>
              </Button>
            </motion.div>

            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-[#02BD9B]/50 text-white hover:bg-[#02BD9B]/10 backdrop-blur-xl px-10 py-4 text-lg shadow-xl"
              >
                <Play className="w-5 h-5 mr-2" />
                Watch Demo
              </Button>
            </motion.div>
          </motion.div>

          {/* Floating Marquee Banner */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.4 }}
            className="mb-16"
          >
            <div className="relative overflow-hidden bg-gradient-to-r from-[#02BD9B]/10 via-[#02BD9B]/8 to-[#02BD9B]/10 backdrop-blur-xl border border-[#02BD9B]/20 rounded-2xl py-3 sm:py-4 shadow-2xl mx-4 sm:mx-0">
              <motion.div
                className="flex space-x-4 sm:space-x-8 whitespace-nowrap"
                animate={{ x: [0, -2000] }}
                transition={{
                  repeat: Infinity,
                  duration: 40,
                  ease: "linear",
                  repeatType: "loop",
                }}
              >
                {[...Array(4)].map((_, groupIndex) =>
                  marqueeItems.map((item, index) => (
                    <span
                      key={`${groupIndex}-${index}`}
                      className="text-[#02BD9B] font-semibold text-sm sm:text-base lg:text-lg whitespace-nowrap px-2 sm:px-4"
                    >
                      {item}
                    </span>
                  ))
                )}
              </motion.div>
            </div>
          </motion.div>
            <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.6 }}
            // Use flex-col on mobile, flex-row on sm+
            className="flex flex-col flex-wrap items-center justify-center gap-4 px-4 mb-12 sm:flex-row sm:gap-6 lg:gap-8 text-white/70 sm:px-0"
            >
            {[
              { icon: CheckCircle, text: "Free to Start" },
              { icon: Zap, text: "AI-Powered" },
              { icon: Shield, text: "Real-time Analysis" },
              { icon: Star, text: "5-Star Rated" },
            ].map((item, index) => (
              <motion.div
              key={index}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 1.8 + index * 0.1, type: "spring" }}
              className="flex items-center space-x-1 cursor-pointer sm:space-x-2 group"
              >
              <item.icon className="h-4 w-4 sm:h-5 sm:w-5 text-[#02BD9B] group-hover:scale-110 transition-transform" />
              <span className="group-hover:text-[#02BD9B] transition-colors text-sm sm:text-base">
                {item.text}
              </span>
              </motion.div>
            ))}
            </motion.div>

            <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 2 }}
            className="absolute pt-8 transform -translate-x-1/2 left-1/2 bottom-2"
            >
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <ChevronDown className="w-6 h-6 text-white/40" />
            </motion.div>
            </motion.div>
        </div>
      </section>

      {/* Three Modes Section */}
      <section id="modes" className="relative w-full py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-[#040404] via-[#02BD9B]/5 to-[#040404]"></div>
        <div className="relative z-10 px-6 mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="mb-20 text-center"
          >
            <Badge className="border-2 border-[#02BD9B]/40 text-[#02BD9B] bg-[#02BD9B]/10 mb-6 px-6 py-2 backdrop-blur-xl">
              Three Powerful Modes
            </Badge>
            <h2 className="mb-6 text-4xl font-bold text-white md:text-5xl">
              Choose Your Arena
            </h2>
            <p className="max-w-3xl mx-auto text-xl text-white/70">
              Each mode crafted for different skill levels and purposes, powered
              by advanced AI
            </p>
          </motion.div>

          <div className="grid gap-8 lg:grid-cols-3">
            {[
              {
                icon: Users,
                title: "Classic Debate",
                description:
                  "Traditional academic structure perfect for students and educational institutions",
                features: [
                  "Structured rounds",
                  "Academic scoring",
                  "Formal analysis",
                  "Educational feedback",
                ],
                gradient: "from-[#02BD9B]/15 to-[#02BD9B]/20",
                glow: "#02BD9B",
              },
              {
                icon: Brain,
                title: "Corporate Training",
                description:
                  "1-on-1 sessions for sales, marketing, and negotiation skill development",
                features: [
                  "Personal coaching",
                  "Sales practice",
                  "Negotiation scenarios",
                  "Skill tracking",
                ],
                gradient: "from-[#02BD9B]/10 to-[#02BD9B]/20",
                glow: "#02BD9B",
              },
              {
                icon: Zap,
                title: "Interactive Mode",
                description:
                  "Game-style debates with AI helpers and round-based competition",
                features: [
                  "AI assistants",
                  "Round gameplay",
                  "Interactive features",
                  "Community engagement",
                ],
                gradient: "from-[#02BD9B]/8 to-[#02BD9B]/15",
                glow: "#02BD9B",
              },
            ].map((mode, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50, rotateX: 30 }}
                whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ duration: 0.8, delay: index * 0.2 }}
                viewport={{ once: true }}
                whileHover={{
                  y: -15,
                  scale: 1.02,
                  rotateX: 5,
                  rotateY: 5,
                }}
                className="group perspective-1000"
              >
                <Card
                  className="relative h-full overflow-hidden border-0 backdrop-blur-xl"
                  style={{
                    background: `linear-gradient(135deg, rgba(4, 4, 4, 0.9), rgba(2, 189, 155, 0.05))`,
                    boxShadow: `0 25px 50px rgba(2, 189, 155, 0.2), 0 0 0 1px rgba(2, 189, 155, 0.1)`,
                  }}
                >
                  <motion.div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100"
                    style={{
                      background: `linear-gradient(135deg, ${mode.gradient})`,
                    }}
                    transition={{ duration: 0.5 }}
                  />

                  <div
                    className="absolute transition-opacity duration-500 opacity-0 -inset-1 bg-gradient-to-r group-hover:opacity-20 blur-xl"
                    style={{
                      background: `linear-gradient(135deg, ${mode.glow}, transparent)`,
                    }}
                  />

                  <CardContent className="relative z-10 flex flex-col h-full p-8">
                    <div className="flex-grow space-y-6">
                      <motion.div
                        className="relative"
                        whileHover={{ rotateY: 15 }}
                        transition={{ duration: 0.3 }}
                      >
                        <div
                          className="absolute inset-0 transition-opacity rounded-full opacity-50 blur-2xl group-hover:opacity-100"
                          style={{ backgroundColor: mode.glow }}
                        />
                        <div
                          className="relative flex items-center justify-center w-16 h-16 border shadow-2xl rounded-2xl backdrop-blur-sm border-white/10"
                          style={{
                            background: `linear-gradient(135deg, ${mode.glow}40, ${mode.glow}20)`,
                          }}
                        >
                          <mode.icon className="w-8 h-8 text-white" />
                        </div>
                      </motion.div>

                      <div>
                        <h3 className="text-2xl font-bold text-white mb-4 group-hover:text-[#02BD9B] transition-colors duration-500">
                          {mode.title}
                        </h3>
                        <p className="leading-relaxed text-white/80">
                          {mode.description}
                        </p>
                      </div>

                      <ul className="flex-grow space-y-3">
                        {mode.features.map((feature, i) => (
                          <motion.li
                            key={i}
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.2 + i * 0.1 }}
                            viewport={{ once: true }}
                            className="flex items-center space-x-3 text-white/80"
                          >
                            <CheckCircle className="h-4 w-4 text-[#02BD9B] flex-shrink-0" />
                            <span>{feature}</span>
                          </motion.li>
                        ))}
                      </ul>

                      <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Button className="w-full bg-[#02BD9B]/20 hover:bg-[#02BD9B] text-white hover:text-[#040404] border-2 border-[#02BD9B]/30 hover:border-[#02BD9B] transition-all duration-300 backdrop-blur-sm shadow-lg font-medium">
                          Try {mode.title}
                          <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                        </Button>
                      </motion.div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Features Section */}
      <section id="features" className="relative w-full py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#02BD9B]/5 via-[#040404] to-[#02BD9B]/3"></div>

        <div className="relative z-10 px-6 mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="mb-20 text-center"
          >
            <Badge className="border-2 border-[#02BD9B]/40 text-[#02BD9B] bg-[#02BD9B]/10 mb-6 px-6 py-2 backdrop-blur-xl">
              AI Intelligence Core
            </Badge>
            <h2 className="mb-6 text-4xl font-bold text-white md:text-5xl">
              Advanced Analysis Engine
            </h2>
            <p className="max-w-3xl mx-auto text-xl text-white/70">
              Comprehensive AI system providing real-time insights and
              intelligent feedback
            </p>
          </motion.div>

          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: MessageSquare,
                title: "Claim Extraction",
                desc: "Automatically identify and structure key arguments with precision analysis",
                color: "#02BD9B",
              },
              {
                icon: Shield,
                title: "Fact Verification",
                desc: "Real-time fact-checking with evidence sourcing and credibility scoring",
                color: "#02BD9B",
              },
              {
                icon: Brain,
                title: "Logic Analysis",
                desc: "Advanced reasoning evaluation detecting fallacies and argument structures",
                color: "#02BD9B",
              },
              {
                icon: Mic,
                title: "Smart Moderation",
                desc: "Intelligent AI moderator ensuring balanced and productive discussions",
                color: "#02BD9B",
              },
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50, scale: 0.8 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, delay: index * 0.15 }}
                viewport={{ once: true }}
                whileHover={{
                  y: -10,
                  scale: 1.05,
                  rotateX: 10,
                }}
                className="text-center group perspective-1000"
              >
                <motion.div
                  className="relative mb-8"
                  whileHover={{ rotateY: 15 }}
                  transition={{ duration: 0.3 }}
                >
                  <div
                    className="absolute inset-0 transition-opacity duration-500 rounded-full opacity-0 blur-3xl group-hover:opacity-100"
                    style={{ backgroundColor: feature.color }}
                  />
                  <div
                    className="relative flex items-center justify-center w-20 h-20 mx-auto border shadow-2xl rounded-3xl backdrop-blur-xl border-white/10"
                    style={{
                      background: `linear-gradient(135deg, ${feature.color}30, ${feature.color}10)`,
                      boxShadow: `0 20px 40px ${feature.color}30`,
                    }}
                  >
                    <motion.div
                      whileHover={{ scale: 1.2, rotate: 360 }}
                      transition={{ duration: 0.5 }}
                    >
                      <feature.icon
                        className="w-10 h-10 text-white"
                        style={{
                          filter: `drop-shadow(0 0 10px ${feature.color})`,
                        }}
                      />
                    </motion.div>
                  </div>
                </motion.div>

                <h3 className="text-xl font-bold text-white mb-4 group-hover:text-[#02BD9B] transition-colors duration-300">
                  {feature.title}
                </h3>
                <p className="leading-relaxed text-white/70">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative w-full py-24">
        <div className="absolute inset-0 bg-gradient-to-r from-[#02BD9B]/8 via-[#040404] to-[#02BD9B]/8"></div>

        <div className="relative z-10 max-w-5xl px-6 mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            <div className="flex items-center justify-center mb-6 space-x-2">
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0, rotate: -180 }}
                  whileInView={{ scale: 1, rotate: 0 }}
                  transition={{ delay: i * 0.1, type: "spring" }}
                  viewport={{ once: true }}
                >
                  <Star className="w-6 h-6 text-yellow-400 fill-current" />
                </motion.div>
              ))}
            </div>
            <h2 className="mb-4 text-3xl font-bold text-white md:text-4xl">
              Trusted by the Community
            </h2>
            <p className="text-lg text-white/70">
              Join thousands of successful debaters using our platform
            </p>
          </motion.div>

          <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
            {[
              { number: "10K+", label: "Active Users", icon: Users },
              {
                number: "50K+",
                label: "Debates Analyzed",
                icon: MessageSquare,
              },
              { number: "98%", label: "Success Rate", icon: Award },
              { number: "24/7", label: "AI Available", icon: Zap },
            ].map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.5 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.15,
                  type: "spring",
                }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.1, y: -5 }}
                className="text-center group"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-[#02BD9B]/30 to-[#02BD9B]/10 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-[#02BD9B]/40 transition-all duration-300 border border-[#02BD9B]/20 shadow-xl">
                  <stat.icon className="h-7 w-7 text-[#02BD9B]" />
                </div>
                <div className="text-3xl font-bold text-[#02BD9B] mb-2">
                  {stat.number}
                </div>
                <div className="text-white/60">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative w-full py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-[#02BD9B]/8 to-[#040404]"></div>

        <div className="relative z-10 max-w-5xl px-6 mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="space-y-10"
          >
            <h2 className="text-4xl font-bold leading-tight text-white md:text-5xl">
              Ready to Master
              <span className="block text-[#02BD9B] mt-2">
                Your Debate Skills?
              </span>
            </h2>

            <p className="max-w-3xl mx-auto text-xl text-white/80">
              Join thousands of users transforming their argumentation abilities
              with AI-powered insights and real-time feedback
            </p>

            <div className="flex flex-col justify-center gap-6 pt-6 sm:flex-row">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-[#02BD9B] to-[#02BD9B]/80 hover:from-[#02BD9B]/90 hover:to-[#02BD9B]/70 text-[#040404] font-semibold px-12 py-4 text-lg shadow-2xl shadow-[#02BD9B]/40 border border-[#02BD9B]/20"
                >
                  Start Free Trial
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  size="lg"
                  variant="outline"
                  className="border-2 border-[#02BD9B]/50 text-white hover:bg-[#02BD9B]/10 backdrop-blur-xl px-12 py-4 text-lg shadow-xl"
                >
                  Contact Sales
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
