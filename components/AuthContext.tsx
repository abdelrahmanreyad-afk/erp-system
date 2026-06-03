"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export type Role = "admin" | "manager" | "agent";

interface AuthUser {
  uid: string;
  email: string;
  name: string;
  role: Role;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const snap = await getDoc(doc(db, "users", firebaseUser.uid));
        if (snap.exists()) {
          const data = snap.data();
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email || "",
            name: data.name || "",
            role: data.role as Role,
          });
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// Role checks
export const canAccessMasters = (role: Role) => role === "admin";
export const canAccessStockManager = (role: Role) => role === "admin";
export const canAccessPricelists = (role: Role) => role === "admin";
export const canAccessUsers = (role: Role) => role === "admin";
export const canAccessInventory = (role: Role) => ["admin", "manager", "agent"].includes(role);