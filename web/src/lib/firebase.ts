import { initializeApp, type FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const hasConfig = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

export const app: FirebaseApp | null = hasConfig ? initializeApp(firebaseConfig) : null;

export const auth = app ? getAuth(app) : null;
export const db = app ? initializeFirestore(app, { localCache: persistentLocalCache() }) : null;
export const storage = app ? getStorage(app) : null;
export const messaging = app ? getMessaging(app) : null;

if (app && import.meta.env.VITE_USE_FIREBASE_EMULATOR === "true") {
  console.log("🔥 Using Firebase Emulators 🔥");
  if (auth) connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  if (db) connectFirestoreEmulator(db, "127.0.0.1", 8080);
} else if (app) {
  try {
    // Para funcionar em produção, substitua a chave abaixo (ou VITE_RECAPTCHA_SITE_KEY no .env)
    // pela chave real do ReCaptcha Enterprise gerada no Google Cloud.
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_RECAPTCHA_SITE_KEY || "SUA_CHAVE_RECAPTCHA_AQUI"),
      isTokenAutoRefreshEnabled: true
    });
  } catch (error: unknown) { const err = error as Error;
    console.warn("App Check failed to initialize:", err);
  }
}

export const firebaseConfigured = hasConfig;
