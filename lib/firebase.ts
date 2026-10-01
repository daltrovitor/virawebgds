import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getMessaging, type Messaging } from "firebase/messaging";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    try {
        app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
        if (typeof window !== 'undefined') {
            messaging = getMessaging(app);
        }
    } catch (e) {
        console.warn("Firebase initialization skipped:", e);
    }
}

export { app, messaging };

