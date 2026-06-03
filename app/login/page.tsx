"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Loader2, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin() {
    setError("");
    if (!email || !password) { setError("Email and password are required."); return; }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = "/";
    } catch (e: any) {
      switch (e.code) {
        case "auth/user-not-found":
        case "auth/wrong-password":
        case "auth/invalid-credential":
          setError("Invalid email or password."); break;
        case "auth/too-many-requests":
          setError("Too many attempts. Please try again later."); break;
        default:
          setError("Login failed: " + e.code);
      }
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Flame className="h-8 w-8 text-orange-500" />
            <span className="text-2xl font-semibold text-foreground">ERP System</span>
          </div>
          <p className="text-sm text-muted-foreground">Sign in to your account</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button className="w-full" onClick={handleLogin} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Sign In
          </Button>
        </div>
      </div>
    </div>
  );
}