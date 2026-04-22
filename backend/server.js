import dotenv from "dotenv";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import chatRouter from "./routes/chat.js";

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), ".env") });

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPath = path.join(__dirname, "..", "frontend");
const pagesPath = path.join(frontendPath, "pages");

app.use(express.json());
app.use(express.static(frontendPath));

app.get("/", (_req, res) => {
  res.sendFile(path.join(pagesPath, "login.html"));
});

app.use("/chat", chatRouter);

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
