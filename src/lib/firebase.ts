import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD_ySfzU-mc2y_Ad7UbAu9nMxA7h82z-ws",
  authDomain: "cc-solvin-apps-tools.firebaseapp.com",
  projectId: "cc-solvin-apps-tools",
  storageBucket: "cc-solvin-apps-tools.firebasestorage.app",
  messagingSenderId: "399460868074",
  appId: "1:399460868074:web:9f1146cbc0e33125935c93"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
