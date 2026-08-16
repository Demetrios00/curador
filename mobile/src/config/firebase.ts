import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const firebaseConfig = {
  apiKey: "AIzaSyCSC4FWh2AGHTkDPA56X2C7_q9YWvJE7p4",
  authDomain: "curador-116c5.firebaseapp.com",
  projectId: "curador-116c5",
  storageBucket: "curador-116c5.firebasestorage.app",
  messagingSenderId: "727918167249",
  appId: "1:727918167249:web:ea51af6b61d3cdf45771f0",
} as const;

const hasPlaceholderValue = Object.values(firebaseConfig).some((value) =>
  /^(SUA_|SEU_|YOUR_|REPLACE_)/i.test(String(value)),
);

if (hasPlaceholderValue) {
  throw new Error("Invalid Firebase configuration: placeholder values detected.");
}

export const app = initializeApp(firebaseConfig);
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
export const db = getFirestore(app);
export const storage = getStorage(app);
