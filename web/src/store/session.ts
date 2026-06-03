import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { create } from "zustand";
import { auth } from "../lib/firebase";
import type { SessionClaims } from "../types/domain";

interface SessionState {
  user: User | null;
  claims: SessionClaims;
  loading: boolean;
  isDemo: boolean;
  start: () => () => void;
  loginDemo: (role: NonNullable<SessionClaims["role"]>) => void;
  logoutDemo: () => void;
  logout: () => Promise<void>;
}

const demoRoleKey = "gesfit-demo-role";

function demoUser(role: NonNullable<SessionClaims["role"]>): User {
  return {
    uid: role === "trainer" ? "trainer-ana" : "student-demo",
    displayName: role === "trainer" ? "Ana Beatriz" : "Marina Souza",
    email: role === "trainer" ? "ana@email.com" : "marina@email.com",
  } as User;
}

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  claims: {},
  loading: true,
  isDemo: false,

  start: () => {
    // Check for persisted demo session first
    const savedRole = window.localStorage.getItem(demoRoleKey) as SessionClaims["role"] | null;
    if (savedRole) {
      set({
        user: demoUser(savedRole),
        claims: { role: savedRole, teamId: "team-movimento" },
        loading: false,
        isDemo: true,
      });
      return () => undefined;
    }

    // If no Firebase config, stay logged out
    if (!auth) {
      set({ loading: false, isDemo: false });
      return () => undefined;
    }

    // Real Firebase Auth listener
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        set({ user: null, claims: {}, loading: false, isDemo: false });
        return;
      }

      const token = await user.getIdTokenResult();
      set({
        user,
        claims: {
          role: token.claims.role as SessionClaims["role"],
          teamId: token.claims.teamId as SessionClaims["teamId"],
        },
        loading: false,
        isDemo: false,
      });
    });
  },

  loginDemo: (role) => {
    window.localStorage.setItem(demoRoleKey, role);
    set({
      user: demoUser(role),
      claims: { role, teamId: "team-movimento" },
      loading: false,
      isDemo: true,
    });
  },

  logoutDemo: () => {
    window.localStorage.removeItem(demoRoleKey);
    // Also sign out of Firebase if authenticated
    if (auth) signOut(auth).catch(() => undefined);
    set({ user: null, claims: {}, loading: false, isDemo: false });
  },

  logout: async () => {
    window.localStorage.removeItem(demoRoleKey);
    if (auth) await signOut(auth);
    set({ user: null, claims: {}, loading: false, isDemo: false });
  },
}));
