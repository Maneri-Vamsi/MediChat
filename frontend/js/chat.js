import { auth, requireAuth, signOut } from "./firebase.js";
import {
  createChatThread,
  getActiveThread,
  getChatHistory,
  getRecentThreads,
  saveChatHistory,
  saveChatSessionEntry,
  setActiveThread
} from "./chat-state.js";

const messages = document.getElementById("messages");
const chatInput = document.getElementById("chat-input");
const sendButton = document.getElementById("send-button");
const recentChats = document.getElementById("recent-chats");
const newChatButton = document.getElementById("new-chat-button");
const logoutButton = document.getElementById("logout-button");
const profileName = document.getElementById("profile-name");
const chatStatus = document.getElementById("chat-status");
const suggestionButtons = document.querySelectorAll("[data-suggestion]");
const voiceToggleButton = document.getElementById("voice-toggle-button");
const voiceReplayButton = document.getElementById("voice-replay-button");
const voiceToggleIcon = document.getElementById("voice-toggle-icon");
const voiceStateText = document.getElementById("voice-state-text");
const voiceWave = document.getElementById("voice-wave");

const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

let history = getChatHistory();
let activeThreadId = null;
let baseStatus = "Connected";
let voiceState = "idle";
let recognition = null;
let lastAiReply = "";
let lastSpokenText = "";

function escapeHtml(value) {
  return `${value}`
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function updateStatus() {
  if (voiceState === "listening") {
    chatStatus.textContent = "Listening...";
    voiceStateText.textContent = "Listening...";
    voiceWave.classList.remove("hidden");
    voiceToggleIcon.textContent = "mic_off";
    voiceToggleButton.classList.add("text-primary", "bg-primary/10");
    voiceToggleButton.setAttribute("aria-pressed", "true");
    return;
  }

  if (voiceState === "processing") {
    chatStatus.textContent = "Processing voice...";
    voiceStateText.textContent = "Processing...";
    voiceWave.classList.remove("hidden");
    voiceToggleIcon.textContent = "mic";
    voiceToggleButton.classList.remove("text-primary", "bg-primary/10");
    voiceToggleButton.setAttribute("aria-pressed", "false");
    return;
  }

  chatStatus.textContent = baseStatus;
  voiceStateText.textContent = "Voice ready";
  voiceWave.classList.add("hidden");
  voiceToggleIcon.textContent = "mic";
  voiceToggleButton.classList.remove("text-primary", "bg-primary/10");
  voiceToggleButton.setAttribute("aria-pressed", "false");
}

function setVoiceState(nextState) {
  voiceState = nextState;
  updateStatus();
}

function getDefaultHeroMarkup() {
  return `
    <div class="max-w-3xl mx-auto text-center space-y-4 mb-16">
      <div class="inline-block px-4 py-1.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed-variant text-xs font-bold tracking-wide uppercase">
        Active Consultation
      </div>
      <h2 class="font-headline text-3xl md:text-5xl font-bold tracking-tight text-on-surface">How can I assist your health today?</h2>
      <p class="text-slate-500 max-w-lg mx-auto leading-relaxed">Responses are grounded in your local medicine datasets using retrieval-augmented generation.</p>
    </div>
  `;
}

function renderRecentChats() {
  recentChats.innerHTML = "";
  const threads = getRecentThreads();

  if (!threads.length) {
    recentChats.innerHTML = '<p class="px-4 py-2 text-xs text-slate-400">No recent consultations yet.</p>';
    return;
  }

  threads.forEach((thread) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `w-full text-left px-4 py-3 rounded-xl transition-all text-sm ${
      thread.id === activeThreadId
        ? "bg-white text-primary shadow-sm font-semibold"
        : "hover:bg-white text-slate-600"
    }`;
    button.innerHTML = `
      <div class="truncate">${escapeHtml(thread.title)}</div>
      <div class="text-[10px] uppercase tracking-wider mt-1 ${
        thread.id === activeThreadId ? "text-primary/70" : "text-slate-400"
      }">${new Date(thread.updatedAt).toLocaleDateString()}</div>
    `;
    button.addEventListener("click", () => {
      loadThread(thread.id);
    });
    recentChats.appendChild(button);
  });
}

function scrollToBottom() {
  setTimeout(() => {
    messages.scrollTo({ top: messages.scrollHeight, behavior: "smooth" });
  }, 100);
}

function createBubble(role, content, meta = role === "user" ? "You" : "AI Assistant") {
  const row = document.createElement("div");
  row.className = `message-row ${role}`;

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  
  // Use marked for AI messages to support bold, lists, etc.
  const renderedContent = role === "ai" && window.marked ? window.marked.parse(content) : content;
  
  bubble.innerHTML = `<div class="message-meta">${meta}</div><div class="message-content">${renderedContent}</div>`;

  row.appendChild(bubble);
  messages.appendChild(row);
  scrollToBottom();
  return row;
}

function renderThread(thread) {
  messages.innerHTML = "";

  if (!thread || !thread.messages.length) {
    messages.innerHTML = getDefaultHeroMarkup();
    return;
  }

  thread.messages.forEach((message) => {
    createBubble(message.role, escapeHtml(message.content), message.role === "user" ? "You" : "AI Assistant");
  });
}

function ensureActiveThread() {
  const activeThread = getActiveThread();

  if (activeThread) {
    activeThreadId = activeThread.id;
    return activeThread;
  }

  const createdState = createChatThread();
  activeThreadId = createdState.activeThreadId;
  return getActiveThread();
}

function loadThread(threadId) {
  setActiveThread(threadId);
  activeThreadId = threadId;
  const thread = getActiveThread();
  renderRecentChats();
  renderThread(thread);
  baseStatus = "Consultation restored";
  updateStatus();
}

function showThinking() {
  return createBubble(
    "ai",
    '<div class="typing-loader" aria-label="AI is thinking"><span></span><span></span><span></span></div><div class="mt-3 text-sm font-medium">AI is thinking...</div>',
    "AI Assistant"
  );
}

function stopSpeaking() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function pickVoice() {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  return (
    voices.find((voice) => /en-us|en-gb/i.test(voice.lang)) ||
    voices.find((voice) => /^en/i.test(voice.lang)) ||
    voices[0] ||
    null
  );
}

function speakText(text) {
  if (!("speechSynthesis" in window) || !text) {
    return;
  }

  stopSpeaking();
  lastSpokenText = text;
  voiceReplayButton.disabled = false;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.volume = 1;

  const voice = pickVoice();
  if (voice) {
    utterance.voice = voice;
  }

  utterance.onend = () => {
    if (voiceState !== "listening") {
      baseStatus = "Connected";
      updateStatus();
    }
  };

  window.speechSynthesis.speak(utterance);
}

function initRecognition() {
  if (!SpeechRecognitionAPI || recognition) {
    return recognition;
  }

  recognition = new SpeechRecognitionAPI();
  recognition.lang = "en-US";
  recognition.continuous = false;
  recognition.interimResults = true;

  recognition.onstart = () => {
    setVoiceState("listening");
    chatInput.focus();
  };

  recognition.onresult = (event) => {
    let transcript = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      transcript += event.results[index][0].transcript;
    }
    chatInput.value = transcript.trim();
  };

  recognition.onerror = (event) => {
    setVoiceState("idle");

    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      alert("Microphone permission is required for voice input.");
      return;
    }

    voiceStateText.textContent = "Could not understand audio";
    setTimeout(() => {
      if (voiceState === "idle") {
        updateStatus();
      }
    }, 1800);
  };

  recognition.onend = () => {
    setVoiceState("idle");
  };

  return recognition;
}

function toggleVoiceInput() {
  const current = initRecognition();

  if (!current) {
    alert("Voice input is not supported in this browser.");
    return;
  }

  if (voiceState === "listening") {
    current.stop();
    setVoiceState("processing");
    return;
  }

  stopSpeaking();
  try {
    current.start();
  } catch (error) {
    alert("Microphone could not start. Please check browser permissions.");
  }
}

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) {
    return;
  }

  if (recognition && voiceState === "listening") {
    recognition.stop();
  }

  stopSpeaking();
  setVoiceState("processing");

  createBubble("user", escapeHtml(text));
  chatInput.value = "";
  baseStatus = "Consulting dataset + AI...";
  updateStatus();

  history = [text, ...history.filter((item) => item !== text)].slice(0, 8);
  saveChatHistory(history);
  renderRecentChats();

  const loadingNode = showThinking();

  try {
    const response = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text })
    });

    const data = await response.json();
    loadingNode.remove();

    if (!response.ok) {
      throw new Error(data.error || "Unable to get response.");
    }

    const replyText = `${data.reply || "No response received."}`;
    lastAiReply = replyText;
    voiceReplayButton.disabled = false;
    createBubble("ai", escapeHtml(replyText));
    baseStatus =
      data.source === "openrouter"
        ? "Connected to OpenRouter"
        : data.source === "dataset-fallback"
          ? "Using local dataset fallback"
          : "Connected";
    setVoiceState("idle");
    saveChatSessionEntry(
      {
        question: text,
        answer: replyText,
        source: data.source || "dataset-fallback"
      },
      activeThreadId
    );
    renderRecentChats();
    speakText(replyText);
  } catch (error) {
    loadingNode.remove();
    createBubble(
      "ai",
      escapeHtml(`I couldn't complete that request right now. ${error.message}`)
    );
    baseStatus = "Connection issue";
    setVoiceState("idle");
  }
}

sendButton.addEventListener("click", sendMessage);
chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    sendMessage();
  }
});

voiceToggleButton.addEventListener("click", toggleVoiceInput);

voiceReplayButton.addEventListener("click", () => {
  if (!lastAiReply) {
    return;
  }

  speakText(lastAiReply);
});

suggestionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    chatInput.value = button.dataset.suggestion || "";
    sendMessage();
  });
});

newChatButton.addEventListener("click", () => {
  stopSpeaking();
  if (recognition && voiceState === "listening") {
    recognition.stop();
  }

  const state = createChatThread();
  activeThreadId = state.activeThreadId;
  messages.innerHTML = getDefaultHeroMarkup();
  renderRecentChats();
  baseStatus = "New consultation started";
  setVoiceState("idle");
  lastAiReply = "";
  voiceReplayButton.disabled = true;
});

logoutButton.addEventListener("click", async () => {
  stopSpeaking();
  await signOut(auth);
  window.location.href = "/pages/login.html";
});

if ("speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    if (lastSpokenText && !window.speechSynthesis.speaking) {
      voiceReplayButton.disabled = false;
    }
  };
}

voiceReplayButton.disabled = true;
updateStatus();

const user = await requireAuth("/pages/login.html");
if (user) {
  profileName.textContent = user.email || "Med Chat User";
  const activeThread = ensureActiveThread();
  renderThread(activeThread);
  renderRecentChats();
  baseStatus = "Connected";
  updateStatus();
}
