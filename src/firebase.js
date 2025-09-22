// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBis3_eiss8yVt2YRRZ4DQleT60g2V0lt4",
  authDomain: "gto-room-booking.firebaseapp.com",
  databaseURL: "https://gto-room-booking-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "gto-room-booking",
  storageBucket: "gto-room-booking.firebasestorage.app",
  messagingSenderId: "727221659839",
  appId: "1:727221659839:web:5b80a60e0a6320f2e77e0a",
  measurementId: "G-EZ82FML5ET"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();