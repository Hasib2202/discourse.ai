"use client";

import { MessageSquare, Twitter, Github, Linkedin } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function Footer() {
  return (
    <footer className="w-full relative overflow-hidden border-t border-[#20808D]/20">
      <div className="absolute inset-0 bg-gradient-to-t from-[#13343B] via-[#091717] to-[#091717]"></div>

      <div className="relative z-10 px-6 py-20 mx-auto max-w-7xl">
        <div className="grid gap-12 mb-16 lg:grid-cols-5">
          <div className="space-y-8 lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="flex items-center space-x-4"
            >
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-[#20808D] to-[#2E565E] rounded-2xl blur-xl opacity-50"></div>
                <div className="relative w-16 h-16 bg-gradient-to-br from-[#20808D] to-[#2E565E] rounded-2xl flex items-center justify-center shadow-2xl border border-white/10">
                  <MessageSquare className="w-8 h-8 text-white" />
                </div>
              </div>
              <div>
                <span className="text-3xl font-bold bg-gradient-to-r from-white to-[#20808D] bg-clip-text text-transparent">
                  Discourse
                </span>
                <p className="text-sm text-white/60">
                  AI-Powered Debate Platform
                </p>
              </div>
            </motion.div>
            <p className="max-w-md text-lg leading-relaxed text-white/70">
              Transforming debates into insights through advanced AI analysis,
              real-time feedback, and intelligent moderation systems.
            </p>

            <div className="flex items-center space-x-6">
              {[
                { icon: Twitter, label: "Twitter" },
                { icon: Github, label: "GitHub" },
                { icon: Linkedin, label: "LinkedIn" },
              ].map((social) => (
                <motion.a
                  key={social.label}
                  href="#"
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-12 h-12 bg-[#20808D]/20 rounded-xl flex items-center justify-center hover:bg-[#20808D]/40 transition-all duration-300 border border-[#20808D]/30 backdrop-blur-sm"
                >
                  <social.icon className="h-5 w-5 text-[#20808D]" />
                </motion.a>
              ))}
            </div>
          </div>

          {[
            {
              title: "Platform",
              links: [
                "Classic Debate",
                "Corporate Training",
                "Interactive Mode",
                "AI Analysis",
                "Live Demo",
              ],
            },
            {
              title: "Company",
              links: ["About Us", "Careers", "Research", "Blog", "Contact"],
            },
            {
              title: "Support",
              links: [
                "Help Center",
                "Documentation",
                "Privacy Policy",
                "Terms of Service",
                "Status",
              ],
            },
          ].map((section, index) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: index * 0.2 }}
              viewport={{ once: true }}
            >
              <h4 className="mb-6 text-lg font-bold text-white">
                {section.title}
              </h4>
              <ul className="space-y-4">
                {section.links.map((link) => (
                  <li key={link}>
                    <Link
                      href="#"
                      className="text-white/70 hover:text-[#20808D] transition-all duration-300 hover:translate-x-2 inline-block"
                    >
                      {link}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          viewport={{ once: true }}
          className="border-t border-[#20808D]/20 pt-12 flex flex-col lg:flex-row justify-between items-center"
        >
          <p className="text-lg text-center text-white/60 lg:text-left">
            © 2024 Discourse. All rights reserved. Built with intelligence.
          </p>
          <div className="flex items-center mt-6 space-x-8 lg:mt-0">
            {["Privacy", "Terms", "Cookies", "Sitemap"].map((link) => (
              <Link
                key={link}
                href="#"
                className="text-white/60 hover:text-[#20808D] transition-colors duration-300 hover:underline"
              >
                {link}
              </Link>
            ))}
          </div>
        </motion.div>
      </div>
    </footer>
  );
}
