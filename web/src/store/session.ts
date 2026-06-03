import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { create } from "zustand";
import { auth, db } from "../lib/firebase";
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
    // If no Firebase config, stay logged out or fallback to local demo
    if (!auth) {
      const savedRole = window.localStorage.getItem(demoRoleKey) as SessionClaims["role"] | null;
      if (savedRole) {
        set({
          user: demoUser(savedRole),
          claims: { role: savedRole, teamId: "team-movimento" },
          loading: false,
          isDemo: true,
        });
      } else {
        set({ loading: false, isDemo: false });
      }
      return () => undefined;
    }

    // Proactively set the demo state on load to avoid flicker,
    // but the onAuthStateChanged listener will run and can override if a real user is logged in.
    const savedRole = window.localStorage.getItem(demoRoleKey) as SessionClaims["role"] | null;
    if (savedRole) {
      set({
        user: demoUser(savedRole),
        claims: { role: savedRole, teamId: "team-movimento" },
        loading: false,
        isDemo: true,
      });
    }

    // Real Firebase Auth listener
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // Se não houver usuário real logado, mas houver demo no LocalStorage, mantém a demo
        const savedRole = window.localStorage.getItem(demoRoleKey) as SessionClaims["role"] | null;
        if (savedRole) {
          set({
            user: demoUser(savedRole),
            claims: { role: savedRole, teamId: "team-movimento" },
            loading: false,
            isDemo: true,
          });
          return;
        }

        set({ user: null, claims: {}, loading: false, isDemo: false });
        return;
      }

      // Se houver um usuário real logado no Firebase Auth, limpa a demo do localStorage imediatamente
      window.localStorage.removeItem(demoRoleKey);

      const token = await user.getIdTokenResult();
      let role = token.claims.role as SessionClaims["role"];
      let teamId = token.claims.teamId as SessionClaims["teamId"];

      // Se as claims customizadas estiverem vazias (plano Spark sem Cloud Functions)
      if (!role && db) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            role = userData.role as SessionClaims["role"];
            teamId = userData.teamId as SessionClaims["teamId"];
          }
        } catch (err) {
          console.error("Erro ao buscar dados do usuário no Firestore:", err);
        }
      }

      set({
        user,
        claims: {
          role,
          teamId,
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
