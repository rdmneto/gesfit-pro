import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { auth } from "./firebase";

const googleProvider = new GoogleAuthProvider();

export async function loginWithEmail(email: string, password: string) {
  if (!auth) throw new Error("Firebase não configurado");
  return signInWithEmailAndPassword(auth, email, password);
}

export async function loginWithGoogle() {
  if (!auth) throw new Error("Firebase não configurado");
  return signInWithPopup(auth, googleProvider);
}

export async function createAccount(email: string, password: string, name: string) {
  if (!auth) throw new Error("Firebase não configurado");
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName: name });
  return credential;
}

export async function resetPassword(email: string) {
  if (!auth) throw new Error("Firebase não configurado");
  return sendPasswordResetEmail(auth, email);
}

export async function logout() {
  if (!auth) return;
  return auth.signOut();
}
