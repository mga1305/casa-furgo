import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyA7LA5IV6vk4ZCkkQpsYcw8NUI3wljHoCg",
  authDomain: "casa-furgo.firebaseapp.com",
  projectId: "casa-furgo",
  storageBucket: "casa-furgo.firebasestorage.app",
  messagingSenderId: "12886167851",
  appId: "1:12886167851:web:048c2fc7a9eb191213f56e"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
