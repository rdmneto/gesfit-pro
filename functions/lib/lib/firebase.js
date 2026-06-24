import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
if (getApps().length === 0) {
    initializeApp();
}
export const adminAuth = getAuth();
export const db = getFirestore();
export const messaging = getMessaging();
