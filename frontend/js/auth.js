import {
  auth,
  createUserWithEmailAndPassword,
  googleProvider,
  redirectIfAuthenticated,
  signInWithPopup,
  signInWithEmailAndPassword
} from "./firebase.js";

const authForm = document.getElementById("auth-form");
const authTitle = document.getElementById("auth-title");
const authSubtitle = document.getElementById("auth-subtitle");
const authToggleLink = document.getElementById("auth-toggle-link");
const authToggleLabel = document.getElementById("auth-toggle-label");
const authError = document.getElementById("auth-error");
const authErrorText = document.getElementById("auth-error-text");
const authSubmitLabel = document.getElementById("auth-submit-label");
const googleButton = document.getElementById("google-signin-button");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

let mode = "login";

function updateMode() {
  const isLogin = mode === "login";
  authTitle.textContent = isLogin ? "Welcome back" : "Create your account";
  authSubtitle.textContent = isLogin
    ? "Sign in to continue your secure medical conversations."
    : "Create a Firebase account to access your secure medical workspace.";
  authToggleLabel.textContent = isLogin
    ? "Don't have an account?"
    : "Already have an account?";
  authToggleLink.textContent = isLogin ? "Create Account" : "Sign In";
  authSubmitLabel.textContent = isLogin ? "Sign in" : "Create account";
}

function showError(message) {
  authError.classList.remove("hidden");
  authError.classList.add("flex");
  authErrorText.textContent = message;
}

function hideError() {
  authError.classList.add("hidden");
  authError.classList.remove("flex");
}

function formatAuthError(error) {
  const lookup = {
    "auth/account-exists-with-different-credential":
      "An account already exists with a different sign-in method.",
    "auth/popup-blocked": "The Google sign-in popup was blocked by the browser.",
    "auth/popup-closed-by-user": "The Google sign-in popup was closed before completion.",
    "auth/email-already-in-use": "This email is already registered.",
    "auth/invalid-credential": "Invalid email or password.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/missing-password": "Please enter your password.",
    "auth/weak-password": "Password should be at least 6 characters."
  };

  return lookup[error.code] || "Authentication failed. Please try again.";
}

authToggleLink.addEventListener("click", (event) => {
  event.preventDefault();
  mode = mode === "login" ? "signup" : "login";
  hideError();
  updateMode();
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideError();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  try {
    if (mode === "login") {
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      await createUserWithEmailAndPassword(auth, email, password);
    }

    window.location.href = "/pages/chat.html";
  } catch (error) {
    showError(formatAuthError(error));
  }
});

googleButton.addEventListener("click", async () => {
  hideError();

  try {
    await signInWithPopup(auth, googleProvider);
    window.location.href = "/pages/chat.html";
  } catch (error) {
    showError(formatAuthError(error));
  }
});

updateMode();
redirectIfAuthenticated("/pages/chat.html");
