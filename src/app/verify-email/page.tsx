"use client";

import { useEffect, useState, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, CheckCircle, Mail, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useSearchParams } from "next/navigation";

function VerifyEmailContent() {
  const [verificationStatus, setVerificationStatus] = useState<
    "loading" | "success" | "error"
  >("loading");
  const [userEmail, setUserEmail] = useState<string>("");
  const searchParams = useSearchParams();

  useEffect(() => {
    document.title = "Verify Email - Discourse AI";
  }, []);

  useEffect(() => {
    async function handleEmailVerification() {
      try {
        // Check if there's a session (user just verified email)
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("Session error:", error);
          setVerificationStatus("error");
          return;
        }

        if (session?.user) {
          setUserEmail(session.user.email || "");
          setVerificationStatus("success");

          // Sign out the user so they can sign in properly
          await supabase.auth.signOut();
        } else {
          // Check URL parameters for verification tokens
          const accessToken = searchParams.get("access_token");
          const refreshToken = searchParams.get("refresh_token");

          if (accessToken && refreshToken) {
            // Set the session with the tokens from URL
            const { data, error: authError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (authError) {
              setVerificationStatus("error");
            } else if (data.user) {
              setUserEmail(data.user.email || "");
              setVerificationStatus("success");
              // Sign out after verification
              await supabase.auth.signOut();
            } else {
              setVerificationStatus("error");
            }
          } else {
            setVerificationStatus("error");
          }
        }
      } catch (error) {
        console.error("Verification error:", error);
        setVerificationStatus("error");
      }
    }

    handleEmailVerification();
  }, [searchParams]);

  return (
    <div className="min-h-screen w-full bg-[#040404] flex items-center justify-center p-4 overflow-hidden relative">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div
            className="absolute inset-0"
            style={{
              background: `
              radial-gradient(circle at 20% 80%, rgba(2, 189, 155, 0.1) 0%, transparent 50%),
              radial-gradient(circle at 80% 20%, rgba(2, 189, 155, 0.08) 0%, transparent 50%),
              radial-gradient(circle at 40% 40%, rgba(2, 189, 155, 0.05) 0%, transparent 50%)
            `,
            }}
          />
        </div>

        <motion.div
          className="absolute top-1/4 left-1/4 w-64 h-64 bg-gradient-to-br from-[#02BD9B]/10 to-transparent rounded-full blur-3xl"
          animate={{
            rotate: 360,
            scale: [1, 1.2, 1],
          }}
          transition={{
            rotate: { duration: 25, repeat: Infinity, ease: "linear" },
            scale: { duration: 8, repeat: Infinity, ease: "easeInOut" },
          }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-gradient-to-br from-[#02BD9B]/8 to-transparent rounded-full blur-3xl"
          animate={{
            rotate: -360,
            scale: [1, 0.8, 1],
          }}
          transition={{
            rotate: { duration: 20, repeat: Infinity, ease: "linear" },
            scale: { duration: 6, repeat: Infinity, ease: "easeInOut" },
          }}
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-8 text-center"
        >
          <Link
            href="/"
            className="inline-flex items-center mb-6 space-x-3 group"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-[#02BD9B] to-[#02BD9B]/70 rounded-2xl blur-lg opacity-50 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative w-12 h-12 bg-gradient-to-br from-[#02BD9B] to-[#02BD9B]/80 rounded-2xl flex items-center justify-center shadow-2xl border border-[#02BD9B]/20">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-white via-[#02BD9B] to-white bg-clip-text text-transparent">
              Discourse
            </span>
          </Link>
        </motion.div>

        {/* Verification Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <Card
            className="border-0 backdrop-blur-xl"
            style={{
              background: `linear-gradient(135deg, rgba(4, 4, 4, 0.9), rgba(2, 189, 155, 0.05))`,
              boxShadow: `0 25px 50px rgba(2, 189, 155, 0.2), 0 0 0 1px rgba(2, 189, 155, 0.1)`,
            }}
          >
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center space-x-2 text-white">
                {verificationStatus === "loading" && (
                  <>
                    <Mail className="w-5 h-5 text-[#02BD9B]" />
                    <span>Verifying Email...</span>
                  </>
                )}
                {verificationStatus === "success" && (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <span>Email Verified!</span>
                  </>
                )}
                {verificationStatus === "error" && (
                  <>
                    <Mail className="w-5 h-5 text-red-400" />
                    <span>Verification Failed</span>
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 text-center">
              {verificationStatus === "loading" && (
                <div className="text-white/80">
                  <div className="w-8 h-8 border-2 border-[#02BD9B] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p>Please wait while we verify your email address...</p>
                </div>
              )}

              {verificationStatus === "success" && (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20">
                      <CheckCircle className="w-8 h-8 text-green-400" />
                    </div>
                    <h2 className="mb-2 text-xl font-semibold text-white">
                      🎉 Verification Successful!
                    </h2>
                    <p className="mb-2 text-white/80">
                      Your email address has been successfully verified.
                    </p>
                    {userEmail && (
                      <p className="text-sm text-[#02BD9B] mb-4">{userEmail}</p>
                    )}
                    <p className="mb-6 text-sm text-white/70">
                      You can now sign in to your account and start using
                      Discourse.
                    </p>
                  </div>

                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Link href="/login">
                      <Button className="w-full bg-gradient-to-r from-[#02BD9B] to-[#02BD9B]/80 hover:from-[#02BD9B]/90 hover:to-[#02BD9B]/70 text-[#040404] font-semibold py-3 shadow-xl shadow-[#02BD9B]/30 border border-[#02BD9B]/20 backdrop-blur-sm transition-all duration-300">
                        Sign In Now
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </Button>
                    </Link>
                  </motion.div>
                </div>
              )}

              {verificationStatus === "error" && (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20">
                      <Mail className="w-8 h-8 text-red-400" />
                    </div>
                    <h2 className="mb-2 text-xl font-semibold text-white">
                      Verification Failed
                    </h2>
                    <p className="mb-4 text-white/80">
                      We couldn&apos;t verify your email address. This could be
                      due to:
                    </p>
                    <ul className="mb-6 space-y-1 text-sm text-left text-white/70">
                      <li>• The verification link has expired</li>
                      <li>• The link has already been used</li>
                      <li>• Invalid or corrupted link</li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <Link href="/signup">
                      <Button
                        variant="outline"
                        className="w-full border-[#02BD9B]/30 text-white hover:bg-[#02BD9B]/10 backdrop-blur-sm transition-all duration-300"
                      >
                        Try Signing Up Again
                      </Button>
                    </Link>
                    <Link href="/login">
                      <Button
                        variant="ghost"
                        className="w-full text-[#02BD9B] hover:text-[#02BD9B]/80 hover:bg-[#02BD9B]/10 transition-all duration-300"
                      >
                        Already have an account? Sign In
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-6 text-center"
        >
          <p className="text-sm text-white/60">
            Need help?{" "}
            <Link
              href="/"
              className="text-[#02BD9B] hover:text-[#02BD9B]/80 transition-colors"
            >
              Contact Support
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#040404] flex items-center justify-center">
          <div className="text-white">Loading...</div>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
