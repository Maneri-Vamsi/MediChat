import { auth, requireAuth, signOut } from "./firebase.js";
import { getDashboardSnapshot } from "./chat-state.js";

const userName = document.getElementById("dashboard-user-name");
const userEmail = document.getElementById("dashboard-user-email");
const heartRateValue = document.getElementById("heart-rate-value");
const sleepValue = document.getElementById("sleep-value");
const waterValue = document.getElementById("water-value");
const caloriesValue = document.getElementById("calories-value");
const insightSummary = document.getElementById("insight-summary");
const consultSummary = document.getElementById("consult-summary");
const recentConsultations = document.getElementById("recent-consultations");
const journalPrimary = document.getElementById("journal-primary");
const journalSecondary = document.getElementById("journal-secondary");
const sourceBadge = document.getElementById("source-badge");
const logoutButton = document.getElementById("logout-button");

function escapeHtml(value) {
  return `${value}`
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const mockData = {
  heartRate: "72",
  sleep: "8h 12m",
  water: "1.2",
  calories: "2.4k",
  insight:
    "Your resting heart rate and sleep efficiency remained stable over the last 24 hours. Continue hydration, medication adherence, and routine monitoring."
};

const user = await requireAuth("/pages/login.html");
const snapshot = getDashboardSnapshot();

if (user) {
  userName.textContent = user.displayName || "Elena";
  userEmail.textContent = user.email || "firebase-user@example.com";
  heartRateValue.textContent = mockData.heartRate;
  sleepValue.textContent = mockData.sleep;
  waterValue.textContent = mockData.water;
  caloriesValue.textContent = mockData.calories;
  insightSummary.textContent = snapshot.latest?.answer || mockData.insight;
  consultSummary.textContent = snapshot.latest
    ? `AI reviewed ${snapshot.totalConsultations} consultation${snapshot.totalConsultations === 1 ? "" : "s"} and the latest topic was ${snapshot.latest.topic.toLowerCase()}.`
    : "Your biometric trends are stable. AI has detected 2 new insights since yesterday.";
  sourceBadge.textContent =
    snapshot.lastSource === "openrouter" ? "OpenRouter Active" : "Dataset Guided";

  const recentItems = snapshot.entries?.slice?.(0, 2) || [];
  if (recentItems.length) {
    recentConsultations.innerHTML = recentItems
      .map(
        (item) => `
          <div class="flex items-center justify-between p-4 bg-surface-container-lowest rounded-full">
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 rounded-full overflow-hidden bg-surface-container flex items-center justify-center">
                <span class="material-symbols-outlined text-primary">forum</span>
              </div>
              <div>
                <h4 class="font-headline text-base font-semibold">${escapeHtml(item.topic)} Consultation</h4>
                <p class="text-on-surface-variant font-label text-xs">${escapeHtml(item.question)}</p>
              </div>
            </div>
            <div class="text-right">
              <p class="font-headline text-sm font-bold">${item.source === "openrouter" ? "AI" : "Dataset"}</p>
              <p class="text-on-surface-variant font-label text-xs">${new Date(item.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        `
      )
      .join("");
  }

  journalPrimary.textContent = snapshot.latest
    ? `Latest consultation focused on ${snapshot.latest.topic.toLowerCase()}. Summary: ${snapshot.latest.answer}`
    : "Felt strong today. No knee pain during the 5km incline. Average pace 5:20/km.";

  journalSecondary.textContent = snapshot.topics.length
    ? `Top chat topics: ${snapshot.topics.map(([topic, count]) => `${topic} (${count})`).join(", ")}.`
    : "Multivitamin and Magnesium 400mg taken at 9:30 PM.";
}

logoutButton.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/pages/login.html";
});
