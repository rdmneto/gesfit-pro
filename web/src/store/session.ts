import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { create } from "zustand";
import { auth, db } from "../lib/firebase";
import type { SessionClaims } from "../types/domain";

interface SessionState {
  user: User | null;
  claims: SessionClaims;
  loading: boolean;
  start: () => () => void;
  logout: () => Promise<void>;
}

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  claims: {},
  loading: true,

  start: () => {
    if (!auth) {
      set({ loading: false });
      return () => undefined;
    }

    // Real Firebase Auth listener
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        set({ user: null, claims: {}, loading: false });
        return;
      }

      const token = await user.getIdTokenResult();
      let role = token.claims.role as SessionClaims["role"];
      let teamId = token.claims.teamId as SessionClaims["teamId"];

      // Se as claims customizadas estiverem vazias (plano Spark sem Cloud Functions),
      // busca os dados do usuário no Firestore
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
      });
    });
  },

  logout: async () => {
    if (auth) await signOut(auth);
    set({ user: null, claims: {}, loading: false });
  },
}));
