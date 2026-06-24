/// <reference lib="webworker" />
import { initializeApp } from "firebase/app";
import { getMessaging, onBackgroundMessage } from "firebase/messaging/sw";
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";

declare let self: ServiceWorkerGlobalScope;

// Allow the SW to update immediately
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

cleanupOutdatedCaches();


precacheAndRoute(self.__WB_MANIFEST || []);

// We only initialize Firebase if we have the config available
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

try {
  if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    const app = initializeApp(firebaseConfig);
    const messaging = getMessaging(app);

    onBackgroundMessage(messaging, (payload) => {
      console.log('[firebase-messaging-sw.js] Received background message ', payload);
      
      const notificationTitle = payload.notification?.title || 'Gesfit Pro';
      const notificationOptions = {
        body: payload.notification?.body,
        icon: '/favicon.svg',
        data: payload.data
      };

      self.registration.showNotification(notificationTitle, notificationOptions);
    });
  }
} catch (error) {
  console.warn("Could not initialize Firebase Messaging in Service Worker", error);
}
