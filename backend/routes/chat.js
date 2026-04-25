import { Router } from "express";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const medicineDatasetPath = path.join(__dirname, "..", "dataset", "data.json");
const diseaseDatasetPath = path.join(__dirname, "..", "dataset", "Disease_symptom_and_patient_profile_dataset.csv");

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "for",
  "from",
  "has",
  "have",
  "how",
  "i",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "tell",
  "me",
  "the",
  "to",
  "what",
  "when",
  "which",
  "why",
  "with"
]);

const GREETINGS = [
  /^(hi|hii|hello|hey|heyy)$/,
  /^(good morning|good afternoon|good evening|good night)$/,
  /^(greetings|greeting)$/
];

const MEDICINE_QUERY_TERMS = ["used for", "use for", "use of", "what is", "medicine", "drug", "tablet", "capsule", "syrup"];
const SYMPTOM_QUERY_TERMS = ["headache", "fever", "body pain", "cold", "cough", "acidity", "stomach pain", "nausea", "vomiting", "rash", "itching"];
const DISEASE_INFO_TERMS = ["symptoms of", "signs of", "about", "tell me about", "what are symptoms of", "cause of", "treatment for"];
const SEVERE_SYMPTOMS = ["chest pain", "unconscious", "bleeding", "severe breathing", "shortness of breath", "stroke", "seizure", "fainting"];

const COMMON_MEDICINES = {
  paracetamol: {
    usedFor: "fever and mild pain relief",
    caution: "do not exceed the label dose and avoid combining it with other paracetamol products"
  },
  dolo: {
    usedFor: "fever and body pain relief (contains paracetamol)",
    caution: "do not exceed the label dose and avoid combining it with other paracetamol products"
  },
  "dolo 650": {
    usedFor: "fever and body pain relief (contains paracetamol)",
    caution: "do not exceed the label dose and avoid combining it with other paracetamol products"
  },
  ibuprofen: {
    usedFor: "pain and inflammation relief",
    caution: "take with food and avoid it if you have stomach ulcers, kidney issues, or a doctor has told you not to use NSAIDs"
  },
  cetirizine: {
    usedFor: "allergy symptoms like sneezing, runny nose, and itching",
    caution: "it can cause drowsiness in some people"
  },
  antacid: {
    usedFor: "acid reflux and acidity relief",
    caution: "follow the label and avoid overuse"
  },
  ors: {
    usedFor: "rehydration when you have fluid loss from vomiting or loose stools",
    caution: "mix only as directed on the packet"
  }
};

const SYMPTOM_MEDICINE_RULES = [
  {
    terms: ["fever", "headache", "body pain", "mild pain", "pain", "ache"],
    medicines: ["Paracetamol"],
    explanation: "This can help lower fever and ease mild pain.",
    selfCare: "Rest, drink fluids, and avoid heavy activity."
  },
  {
    terms: ["cold", "cough", "sore throat", "runny nose"],
    medicines: ["Paracetamol", "Warm fluids and steam inhalation"],
    explanation: "This may ease fever, throat discomfort, and congestion.",
    selfCare: "Rest well and keep yourself hydrated."
  },
  {
    terms: ["acidity", "heartburn", "indigestion"],
    medicines: ["Antacid"],
    explanation: "This can reduce acid-related discomfort.",
    selfCare: "Eat small meals and avoid spicy food for now."
  }
];

const DISEASE_SYMPTOM_HINTS = {
  dengue: ["fever", "headache", "body pain", "fatigue", "nausea", "rash"],
  malaria: ["fever", "chills", "sweating", "headache", "fatigue"],
  influenza: ["fever", "cough", "fatigue", "body pain"],
  migraine: ["headache", "nausea", "sensitivity to light", "fatigue"],
  asthma: ["cough", "difficulty breathing", "wheezing", "chest tightness"],
  diabetes: ["increased thirst", "frequent urination", "fatigue", "blurred vision"]
};

let cachedMedicineDataset = null;
let cachedDiseaseDataset = null;

function normalizeText(value) {
  return `${value || ""}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTokens(value) {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token && !STOPWORDS.has(token));
}

function isGreeting(message) {
  const normalized = normalizeText(message);
  return GREETINGS.some((pattern) => pattern.test(normalized));
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

async function loadMedicineDataset() {
  if (cachedMedicineDataset) {
    return cachedMedicineDataset;
  }

  const raw = await readFile(medicineDatasetPath, "utf8");
  cachedMedicineDataset = JSON.parse(raw);
  return cachedMedicineDataset;
}

async function loadDiseaseDataset() {
  if (cachedDiseaseDataset) {
    return cachedDiseaseDataset;
  }

  const raw = await readFile(diseaseDatasetPath, "utf8");
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0]);
  const symptomColumns = headers.filter((header) =>
    !["Disease", "Age", "Gender", "Blood Pressure", "Cholesterol Level", "Outcome Variable"].includes(header)
  );

  const diseaseMap = new Map();

  lines.slice(1).forEach((line) => {
    const values = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
    const disease = row.Disease?.trim();

    if (!disease) {
      return;
    }

    if (!diseaseMap.has(disease)) {
      diseaseMap.set(disease, {
        name: disease,
        total: 0,
        symptomCounts: Object.fromEntries(symptomColumns.map((column) => [column, 0]))
      });
    }

    const diseaseEntry = diseaseMap.get(disease);
    diseaseEntry.total += 1;

    symptomColumns.forEach((column) => {
      if ((row[column] || "").trim().toLowerCase() === "yes") {
        diseaseEntry.symptomCounts[column] += 1;
      }
    });
  });

  cachedDiseaseDataset = { symptomColumns, diseaseMap };
  return cachedDiseaseDataset;
}

function scoreEntry(message, entry) {
  const normalizedMessage = normalizeText(message);
  return entry.keywords.reduce((score, keyword) => {
    return normalizedMessage.includes(normalizeText(keyword)) ? score + 1 : score;
  }, 0);
}

function findBestMedicineEntry(message, dataset) {
  const ranked = dataset
    .map((entry) => ({ ...entry, score: scoreEntry(message, entry) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return ranked[0] || null;
}

function findMatchingDisease(message, diseaseDataset) {
  const normalizedMessage = normalizeText(message);
  const tokens = normalizeTokens(message);
  const diseaseNames = [...diseaseDataset.diseaseMap.keys()].sort((a, b) => b.length - a.length);

  return diseaseNames.find((disease) => {
    const normalizedDisease = normalizeText(disease);
    const diseaseTokens = normalizedDisease.split(" ");
    return (
      normalizedMessage.includes(normalizedDisease) ||
      diseaseTokens.some((token) => token.length > 3 && normalizedMessage.includes(token)) ||
      tokens.includes(normalizedDisease)
    );
  });
}

function detectIntent(message, diseaseDataset, medicineDataset) {
  const normalizedMessage = normalizeText(message);
  const tokens = normalizeTokens(message);
  const diseaseName = findMatchingDisease(message, diseaseDataset);
  const medicineEntry = findBestMedicineEntry(message, medicineDataset);
  const medicineNameMatch = Object.keys(COMMON_MEDICINES).find((medicine) => normalizedMessage.includes(medicine));
  const symptomMatch = SYMPTOM_QUERY_TERMS.some((term) => normalizedMessage.includes(term));
  const diseaseInfoMatch = DISEASE_INFO_TERMS.some((term) => normalizedMessage.includes(term));
  const medicineQueryMatch = MEDICINE_QUERY_TERMS.some((term) => normalizedMessage.includes(term)) || medicineNameMatch;

  if (diseaseInfoMatch && diseaseName) {
    return { intent: "DISEASE_INFO", diseaseName };
  }

  if (medicineQueryMatch && (medicineEntry || medicineNameMatch)) {
    return { intent: "MEDICINE_QUERY", medicineEntry, medicineName: medicineNameMatch };
  }

  if (tokens.some((token) => SYMPTOM_QUERY_TERMS.includes(token)) || symptomMatch) {
    return { intent: "SYMPTOM_QUERY" };
  }

  if (diseaseName && normalizedMessage.includes("symptom")) {
    return { intent: "DISEASE_INFO", diseaseName };
  }

  if (diseaseName && (normalizedMessage.includes("what is") || normalizedMessage.includes("tell me about"))) {
    return { intent: "DISEASE_INFO", diseaseName };
  }

  if (diseaseName && tokens.length >= 1) {
    return { intent: "DISEASE_INFO", diseaseName };
  }

  if (medicineNameMatch) {
    return { intent: "MEDICINE_QUERY", medicineName: medicineNameMatch };
  }

  return { intent: "GENERAL" };
}

function buildSymptomQueryResponse(message) {
  const normalizedMessage = normalizeText(message);

  if (SEVERE_SYMPTOMS.some((term) => normalizedMessage.includes(term))) {
    return [
      "Urgent: seek medical help immediately.",
      "This may be a serious symptom and needs prompt evaluation."
    ].join("\n");
  }

  const matchedRule = SYMPTOM_MEDICINE_RULES.find((rule) =>
    rule.terms.some((term) => normalizedMessage.includes(term))
  ) || SYMPTOM_MEDICINE_RULES[0];

  return [
    `Possible medicines:`,
    ...matchedRule.medicines.map((medicine) => `- ${medicine}`),
    "",
    `Short explanation: ${matchedRule.explanation}`,
    `Basic care: ${matchedRule.selfCare}`,
    "Consult a doctor if it persists.",
    "Use only as directed."
  ].join("\n");
}

function buildMedicineQueryResponse(message, medicineDataset) {
  const normalizedMessage = normalizeText(message);
  const tokens = normalizeTokens(message);
  const medicineKey =
    Object.keys(COMMON_MEDICINES).find((medicine) => normalizedMessage.includes(medicine)) ||
    tokens.find((token) => COMMON_MEDICINES[token]);
  const matchingEntry = findBestMedicineEntry(message, medicineDataset);

  if (medicineKey && COMMON_MEDICINES[medicineKey]) {
    const info = COMMON_MEDICINES[medicineKey];
    return [
      `What it is used for: ${medicineKey === "ors" ? "rehydration support" : info.usedFor}.`,
      `Dosage caution: ${info.caution}.`,
      "Use only as directed."
    ].join("\n");
  }

  if (matchingEntry) {
    const keywords = matchingEntry.keywords.join(", ");
    const isLikelyPrescription = /augmentin|azithral|amoxicillin|clavulanic|antibiotic/i.test(keywords);
    const useText =
      isLikelyPrescription
        ? "This is usually used for bacterial infections when prescribed by a doctor."
        : matchingEntry.response.split(".")[0].trim() + ".";

    return [
      `What it is used for: ${useText}`,
      "Dosage caution: follow the package label or your doctor's advice; do not self-adjust the dose.",
      "Use only as directed."
    ].join("\n");
  }

  return [
    "What it is used for: I could not match that medicine exactly.",
    "Dosage caution: please check the label or ask a pharmacist or doctor before using it.",
    "Use only as directed."
  ].join("\n");
}

function buildDiseaseInfoResponse(diseaseName, diseaseDataset) {
  const diseaseEntry = diseaseDataset.diseaseMap.get(diseaseName);

  if (!diseaseEntry) {
    return `I could not find ${diseaseName} in the current dataset.`;
  }

  const commonSymptoms = Object.entries(diseaseEntry.symptomCounts)
    .filter(([, count]) => count / diseaseEntry.total >= 0.3)
    .map(([symptom]) => `- ${symptom}`);

  const fallbackSymptoms = Object.entries(diseaseEntry.symptomCounts)
    .filter(([, count]) => count > 0)
    .slice(0, 5)
    .map(([symptom]) => `- ${symptom}`);

  const symptomsList = commonSymptoms.length ? commonSymptoms : fallbackSymptoms;
  const diseaseKey = Object.keys(DISEASE_SYMPTOM_HINTS).find((key) => normalizeText(diseaseName).includes(key));
  const diseaseHint = diseaseKey ? DISEASE_SYMPTOM_HINTS[diseaseKey] : [];
  const hintLines = diseaseHint.length ? diseaseHint.map((symptom) => `- ${symptom}`) : symptomsList;

  return [
    `Overview: ${diseaseName} is a condition that can affect the body in different ways.`,
    "Symptoms:",
    ...hintLines,
    "When to seek medical help: if symptoms are severe, persistent, or include breathing trouble, chest pain, high fever, confusion, or dehydration."
  ].join("\n");
}

async function callOpenRouter(message, context = "") {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://medichat.onrender.com",
        "X-Title": "MediChat"
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        messages: [
          {
            role: "system",
            content: `You are a professional medical assistant. Use the following context to answer the user's question. 
            Keep answers concise, safe, and professional. 
            If the context doesn't contain the answer, say you don't know but provide general safe medical advice.
            ALWAYS include a medical disclaimer.
            Context: ${context}`
          },
          { role: "user", content: message }
        ]
      })
    });

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.error("OpenRouter Error:", error);
    return null;
  }
}

function buildGeneralResponse(message) {
  return `I can help with symptoms, medicines, and disease questions. Please ask about a medical concern, and I will keep the answer simple and safe.`;
}

router.post("/", async (req, res) => {
  try {
    const message = `${req.body?.message || ""}`.trim();

    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    if (isGreeting(message)) {
      return res.json({
        reply: "Hello! Please share your medical question.",
        source: "greeting"
      });
    }

    const [medicineDataset, diseaseDataset] = await Promise.all([loadMedicineDataset(), loadDiseaseDataset()]);
    const intent = detectIntent(message, diseaseDataset, medicineDataset);

    let reply = "";
    let context = "";
    let source = "dataset";

    if (intent.intent === "SYMPTOM_QUERY") {
      reply = buildSymptomQueryResponse(message);
      context = reply;
    } else if (intent.intent === "MEDICINE_QUERY") {
      reply = buildMedicineQueryResponse(message, medicineDataset);
      context = reply;
    } else if (intent.intent === "DISEASE_INFO" && intent.diseaseName) {
      reply = buildDiseaseInfoResponse(intent.diseaseName, diseaseDataset);
      context = reply;
    } else {
      reply = buildGeneralResponse(message);
      context = "General medical assistance query.";
    }

    // Try to enhance with OpenRouter
    const enhancedReply = await callOpenRouter(message, context);
    if (enhancedReply) {
      reply = enhancedReply;
      source = "openrouter";
    } else {
      source = "dataset-fallback";
    }

    return res.json({
      reply,
      source: source
    });
  } catch (error) {
    return res.status(500).json({
      error: "Unable to process chat request.",
      details: error.message
    });
  }
});

export default router;
