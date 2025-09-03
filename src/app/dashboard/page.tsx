"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, LogOut, User } from "lucide-react";
import { getCurrentUser, signOut } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function DashboardPage() {
  const [user, setUser] = useState<{
    email?: string;
    user_metadata?: {
      full_name?: string;
    };
    email_confirmed_at?: string;
    created_at?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadUser() {
      try {
        const currentUser = await getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
        } else {
          router.push("/login");
        }
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [router]);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Signed out successfully");
      router.push("/");
    } catch {
      toast.error("Error signing out");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#091717] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#091717] p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#20808D] to-[#2E565E] rounded-xl flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          </div>
          <Button
            onClick={handleSignOut}
            variant="outline"
            className="border-[#20808D]/30 text-white hover:bg-[#20808D]/10"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>

        {/* Welcome Card */}
        <Card
          className="border-0 backdrop-blur-xl mb-6"
          style={{
            background: `linear-gradient(135deg, rgba(19, 52, 59, 0.8), rgba(46, 86, 94, 0.6))`,
            boxShadow: `0 25px 50px rgba(32, 128, 141, 0.2), 0 0 0 1px rgba(32, 128, 141, 0.1)`,
          }}
        >
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <User className="w-5 h-5 mr-2 text-[#20808D]" />
              Welcome back!
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-white/80">
              <p>
                <strong>Name:</strong> {user?.user_metadata?.full_name || "N/A"}
              </p>
              <p>
                <strong>Email:</strong> {user?.email}
              </p>
              <p>
                <strong>Email Verified:</strong>{" "}
                {user?.email_confirmed_at ? "Yes" : "No"}
              </p>
              <p>
                <strong>Joined:</strong>{" "}
                {user?.created_at
                  ? new Date(user.created_at).toLocaleDateString()
                  : "N/A"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Success Message */}
        <Card
          className="border-0 backdrop-blur-xl"
          style={{
            background: `linear-gradient(135deg, rgba(19, 52, 59, 0.8), rgba(46, 86, 94, 0.6))`,
            boxShadow: `0 25px 50px rgba(32, 128, 141, 0.2), 0 0 0 1px rgba(32, 128, 141, 0.1)`,
          }}
        >
          <CardContent className="p-6">
            <div className="text-center text-white">
              <h2 className="text-xl font-semibold mb-2 text-[#20808D]">
                🎉 Account Verified Successfully!
              </h2>
              <p className="text-white/80">
                Your email has been verified and you&apos;re now logged in to
                Discourse.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
