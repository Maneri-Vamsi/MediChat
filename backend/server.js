import dotenv from "dotenv";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import helmet from "helmet";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import chatRouter from "./routes/chat.js";

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), ".env") });

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPath = path.join(__dirname, "..", "frontend");
const pagesPath = path.join(frontendPath, "pages");

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "'unsafe-inline'", "cdn.tailwindcss.com", "https://*.firebaseapp.com", "https://*.googleapis.com"],
      "connect-src": ["'self'", "https://*.firebaseio.com", "https://*.googleapis.com", "https://openrouter.ai"],
      "img-src": ["'self'", "data:", "https://*.googleusercontent.com"]
    }
  }
}));
app.use(cors());
app.use(express.json());
app.use(express.static(frontendPath));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: "Too many requests, please try again later." }
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(pagesPath, "login.html"));
});

app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));
app.use("/chat", limiter, chatRouter);

const PORT = Number(process.env.PORT) || 5000;

function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Local: http://localhost:${port}`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.log(`Port ${port} is busy, trying ${port + 1}...`);
      startServer(Number(port) + 1);
    } else {
      console.error(err);
    }
  });

  const gracefulShutdown = () => {
    if (server.closeAllConnections) server.closeAllConnections();
    server.close(() => process.exit(0));
  };

  process.removeAllListeners("SIGINT");
  process.removeAllListeners("SIGTERM");
  process.removeAllListeners("SIGUSR2");
  
  process.on("SIGINT", gracefulShutdown);
  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGUSR2", gracefulShutdown);
}

startServer(PORT);
