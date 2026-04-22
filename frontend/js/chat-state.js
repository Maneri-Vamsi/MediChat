const CHAT_HISTORY_KEY = "medchat-history";
const CHAT_SESSION_KEY = "medchat-session";

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getChatHistory() {
  return readJson(CHAT_HISTORY_KEY, []);
}

function saveChatHistory(history) {
  saveJson(CHAT_HISTORY_KEY, history.slice(0, 8));
}

function inferTopic(text = "") {
  const lower = text.toLowerCase();
  const topicMap = [
    { name: "Antibiotics", keywords: ["augmentin", "azithral", "azithromycin", "amoxicillin"] },
    { name: "Fever", keywords: ["fever", "temperature"] },
    { name: "Respiratory", keywords: ["cough", "cold", "sore throat"] },
    { name: "Vitals", keywords: ["blood pressure", "bp", "heart rate", "hrv"] },
    { name: "Diabetes", keywords: ["diabetes", "glucose", "blood sugar"] },
    { name: "Supplements", keywords: ["zincovit", "vitamin", "supplement"] }
  ];

  const matched = topicMap.find((topic) =>
    topic.keywords.some((keyword) => lower.includes(keyword))
  );

  return matched?.name || "General";
}

function buildSessionEntry({ question, answer, source }) {
  const topic = inferTopic(question);
  return {
    id: Date.now(),
    question,
    answer,
    source,
    topic,
    createdAt: new Date().toISOString()
  };
}

function defaultSessionState() {
  return {
    entries: [],
    topicCounts: {},
    lastSource: "dataset-fallback",
    threads: [],
    activeThreadId: null
  };
}

function buildThreadTitle(question = "") {
  const clean = question.trim();
  if (!clean) {
    return "New Consultation";
  }

  return clean.length > 42 ? `${clean.slice(0, 42)}...` : clean;
}

function hydrateSessionState(rawState) {
  const state = {
    ...defaultSessionState(),
    ...rawState
  };

  if (!Array.isArray(state.threads) || !state.threads.length) {
    state.threads = (state.entries || []).map((entry) => ({
      id: entry.id,
      title: buildThreadTitle(entry.question),
      createdAt: entry.createdAt,
      updatedAt: entry.createdAt,
      messages: [
        { role: "user", content: entry.question, createdAt: entry.createdAt },
        { role: "ai", content: entry.answer, createdAt: entry.createdAt, source: entry.source }
      ]
    }));
  }

  if (!state.activeThreadId && state.threads.length) {
    state.activeThreadId = state.threads[0].id;
  }

  return state;
}

function readChatSession() {
  return hydrateSessionState(readJson(CHAT_SESSION_KEY, defaultSessionState()));
}

function saveChatSession(state) {
  saveJson(CHAT_SESSION_KEY, state);
  return state;
}

function createChatThread(title = "New Consultation") {
  const state = readChatSession();
  const thread = {
    id: Date.now(),
    title,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: []
  };

  const nextState = {
    ...state,
    threads: [thread, ...state.threads].slice(0, 12),
    activeThreadId: thread.id
  };

  return saveChatSession(nextState);
}

function setActiveThread(threadId) {
  const state = readChatSession();
  const nextState = {
    ...state,
    activeThreadId: threadId
  };

  return saveChatSession(nextState);
}

function getActiveThread() {
  const state = readChatSession();
  return (
    state.threads.find((thread) => thread.id === state.activeThreadId) ||
    state.threads[0] ||
    null
  );
}

function getRecentThreads() {
  return readChatSession().threads;
}

function saveChatSessionEntry(payload, threadId) {
  const state = readChatSession();
  const entry = buildSessionEntry(payload);
  const entries = [entry, ...state.entries].slice(0, 12);
  const topicCounts = entries.reduce((accumulator, current) => {
    accumulator[current.topic] = (accumulator[current.topic] || 0) + 1;
    return accumulator;
  }, {});

  const nextState = {
    entries,
    topicCounts,
    lastSource: payload.source || state.lastSource,
    threads: state.threads.map((thread) => {
      if (thread.id !== threadId) {
        return thread;
      }

      const isFirstMessage = !thread.messages.length;

      return {
        ...thread,
        title: isFirstMessage ? buildThreadTitle(payload.question) : thread.title,
        updatedAt: entry.createdAt,
        messages: [
          ...thread.messages,
          { role: "user", content: payload.question, createdAt: entry.createdAt },
          {
            role: "ai",
            content: payload.answer,
            createdAt: entry.createdAt,
            source: payload.source || "dataset-fallback"
          }
        ]
      };
    }),
    activeThreadId: threadId || state.activeThreadId
  };

  nextState.threads.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  return saveChatSession(nextState);
}

function clearChatSession() {
  saveChatSession(defaultSessionState());
}

function getDashboardSnapshot() {
  const state = readChatSession();
  const latest = state.entries[0] || null;
  const totalConsultations = state.entries.length;
  const aiConsultations = state.entries.filter((entry) => entry.source === "openrouter").length;
  const topics = Object.entries(state.topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return {
    entries: state.entries,
    latest,
    totalConsultations,
    aiConsultations,
    topics,
    lastSource: state.lastSource
  };
}

export {
  CHAT_HISTORY_KEY,
  createChatThread,
  clearChatSession,
  getActiveThread,
  getChatHistory,
  getDashboardSnapshot,
  getRecentThreads,
  inferTopic,
  readChatSession,
  saveChatHistory,
  saveChatSessionEntry,
  setActiveThread
};
