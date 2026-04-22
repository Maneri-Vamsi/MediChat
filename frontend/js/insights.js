import { auth, requireAuth, signOut } from "./firebase.js";
import { readChatSession } from "./chat-state.js";

const { Chart } = window;
const userName = document.getElementById("insights-user-name");
const userEmail = document.getElementById("insights-user-email");
const insightsSubtitle = document.getElementById("insights-subtitle");
const recommendationOne = document.getElementById("recommendation-one");
const recommendationTwo = document.getElementById("recommendation-two");
const recommendationThree = document.getElementById("recommendation-three");
const logoutButton = document.getElementById("logout-button");

const user = await requireAuth("/pages/login.html");
const chatState = readChatSession();
const topicEntries = Object.entries(chatState.topicCounts);
const topicLabels = (topicEntries.length ? topicEntries : [["General", 1]]).map(([topic]) => topic);
const topicValues = (topicEntries.length ? topicEntries : [["General", 1]]).map(([, count]) => count);

if (user) {
  userName.textContent = user.displayName || "Sarah Jenkins";
  userEmail.textContent = user.email || "firebase-user@example.com";
  insightsSubtitle.textContent = chatState.entries.length
    ? `Built from ${chatState.entries.length} recent chatbot consultation${chatState.entries.length === 1 ? "" : "s"} and their dominant medical themes.`
    : "Deep-dive analysis of your metabolic and cardiovascular trends over the last 30 days.";
}

const hrvCtx = document.getElementById("hrvChart");
const trendCtx = document.getElementById("trendChart");

new Chart(hrvCtx, {
  type: "line",
  data: {
    labels: ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"],
    datasets: [
      {
        label: "HRV (ms)",
        data: [58, 62, 65, 71, 68, 74, 72],
        borderColor: "#004497",
        backgroundColor: "rgba(0, 68, 151, 0.12)",
        fill: true,
        tension: 0.35,
        pointBackgroundColor: "#004497",
        pointRadius: 4
      }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: false, grid: { color: "#e0e3e5" } }
    }
  }
});

new Chart(trendCtx, {
  type: "bar",
  data: {
    labels: topicLabels,
    datasets: [
      {
        label: "Consultations",
        data: topicValues,
        backgroundColor: ["#c9e2fd", "#005bc5", "#004497", "#97f0ff", "#7ad4e2", "#aec6ff", "#d8e2ff"],
        borderRadius: 999
      }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      x: { grid: { display: false } },
      y: { grid: { color: "#e0e3e5" } }
    }
  }
});

const latest = chatState.entries[0];
if (latest) {
  recommendationOne.textContent = `Recent chatbot focus was ${latest.topic.toLowerCase()}, so the system is prioritizing guidance related to that consultation.`;
  recommendationTwo.textContent = `AI source used most recently: ${latest.source === "openrouter" ? "OpenRouter response generation" : "local dataset fallback guidance"}.`;
  recommendationThree.textContent = `Latest question reviewed: ${latest.question}`;
}

logoutButton.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/pages/login.html";
});
