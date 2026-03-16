import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL
};

function isValidUrl(value) {
  if (!value) {
    return false;
  }

  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function isValidFirebaseConfig(config) {
  const requiredFields = [
    "apiKey",
    "authDomain",
    "projectId",
    "storageBucket",
    "messagingSenderId",
    "appId"
  ];

  if (!requiredFields.every((field) => Boolean(config[field]))) {
    return false;
  }

  return !config.databaseURL || isValidUrl(config.databaseURL);
}

export const isFirebaseConfigured = isValidFirebaseConfig(firebaseConfig);

if (Object.values(firebaseConfig).some(Boolean) && !isFirebaseConfigured) {
  console.warn(
    "Firebase config is incomplete or invalid. Falling back to demo mode."
  );
}

const firebaseApp = isFirebaseConfigured
  ? getApps()[0] ?? initializeApp(firebaseConfig)
  : null;

export const auth = firebaseApp ? getAuth(firebaseApp) : null;
export const db = firebaseApp ? getFirestore(firebaseApp) : null;
export const rtdb = firebaseApp ? getDatabase(firebaseApp) : null;
export const storage = firebaseApp ? getStorage(firebaseApp) : null;
