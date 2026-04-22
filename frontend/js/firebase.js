import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCPYVD83nAQFZOJUWSjuzZhqGqtBLi8Kss",
  authDomain: "dava-ghar.firebaseapp.com",
  projectId: "dava-ghar",
  storageBucket: "dava-ghar.firebasestorage.app",
  messagingSenderId: "732828612296",
  appId: "1:732828612296:web:2e44fe1930b82bab7497fd",
  measurementId: "G-FKCP1FYVHY"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
await setPersistence(auth, browserLocalPersistence);

function redirectTo(path) {
  window.location.href = path;
}

function requireAuth(redirectPath = "/pages/login.html") {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => {
      if (!user) {
        redirectTo(redirectPath);
        resolve(null);
        return;
      }

      resolve(user);
    });
  });
}

function redirectIfAuthenticated(targetPath = "/pages/chat.html") {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      redirectTo(targetPath);
    } else {
      document.body.classList.add("ready");
      document.documentElement.classList.add("ready");
    }
  });
}

export {
  app,
  auth,
  createUserWithEmailAndPassword,
  googleProvider,
  onAuthStateChanged,
  redirectIfAuthenticated,
  requireAuth,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut
};
