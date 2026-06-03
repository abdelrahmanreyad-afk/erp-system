import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCSKRdusVQQm-gciZp7XXMbW_NLPTZnFfo",
  authDomain: "rb-direct-sales-master.firebaseapp.com",
  projectId: "rb-direct-sales-master",
  storageBucket: "rb-direct-sales-master.firebasestorage.app",
  messagingSenderId: "927248997076",
  appId: "1:927248997076:web:a6d0204f5ce8ff89f2b941",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);
export const auth = getAuth(app);