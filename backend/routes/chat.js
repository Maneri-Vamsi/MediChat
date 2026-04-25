import { Router } from "express";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const medicineDatasetPath = path.join(__dirname, "..", "dataset", "data.json");
const diseaseDatasetPath = path.join(__dirname, "..", "dataset", "Disease_symptom_and_patient_profile_dataset.csv");

let cachedMedicineDataset = null;
let cachedDiseaseDataset = null;

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
  if (cachedMedicineDataset) return cachedMedicineDataset;
  const raw = await readFile(medicineDatasetPath, "utf8");
  cachedMedicineDataset = JSON.parse(raw);
  return cachedMedicineDataset;
}

async function loadDiseaseDataset() {
  if (cachedDiseaseDataset) return cachedDiseaseDataset;
  const raw = await readFile(diseaseDatasetPath, "utf8");
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0]);
  const diseaseMap = new Map();

  lines.slice(1).forEach((line) => {
    const values = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
    const disease = row.Disease?.trim();
    if (!disease) return;

    if (!diseaseMap.has(disease)) {
      diseaseMap.set(disease, { name: disease, symptoms: [] });
    }
    const entry = diseaseMap.get(disease);
    headers.forEach((h, i) => {
      if (values[i]?.toLowerCase() === "yes" && !entry.symptoms.includes(h)) {
        entry.symptoms.push(h);
      }
    });
  });

  cachedDiseaseDataset = Array.from(diseaseMap.values());
  return cachedDiseaseDataset;
}

async function callOpenRouter(message, context) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("API Key missing");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://medichat.onrender.com",
      "X-Title": "MediChat AI"
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-001",
      messages: [
        {
          role: "system",
          content: `You are Medichat AI, a professional, empathetic, and highly capable medical assistant. 
          You have COMPLETE POWER to answer any medical query, but you must prioritize the provided knowledge base for accuracy.

          KNOWLEDGE BASE (Grounded Data):
          ${JSON.stringify(context)}

          GUIDELINES:
          1. Use the Knowledge Base to identify symptoms, diseases, and medicines.
          2. If the user asks about something NOT in the knowledge base, use your general medical expertise to provide a safe, helpful response.
          3. ALWAYS maintain a professional yet empathetic tone.
          4. ALWAYS include a concise medical disclaimer at the end.
          5. Keep responses structured and easy to read (use bullet points if needed).
          6. If symptoms are severe (chest pain, breathing trouble), urge the user to seek emergency care immediately.`
        },
        { role: "user", content: message }
      ]
    })
  });

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "I'm sorry, I'm having trouble processing that right now.";
}

router.post("/", async (req, res) => {
  try {
    const message = `${req.body?.message || ""}`.trim();
    if (!message) return res.status(400).json({ error: "Message is required." });

    const [medicines, diseases] = await Promise.all([loadMedicineDataset(), loadDiseaseDataset()]);
    
    const context = {
      available_medicines: medicines,
      disease_patterns: diseases
    };

    const reply = await callOpenRouter(message, context);

    return res.json({
      reply,
      source: "openrouter"
    });
  } catch (error) {
    console.error("Chat Error:", error);
    return res.status(500).json({
      error: "Unable to process chat request.",
      details: error.message
    });
  }
});

export default router;
