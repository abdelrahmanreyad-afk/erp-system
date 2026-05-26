import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCSKRdusVQQm-gciZp7XXMbW_NLPTZnFfo",
  authDomain: "rb-direct-sales-master.firebaseapp.com",
  projectId: "rb-direct-sales-master",
};

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);

export { db };