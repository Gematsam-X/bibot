import express, { json } from "express";
import cors from "cors";
import { askOllama } from "../services/ollama.ts";

const app = express();

const PORT = 3000;

app.use(cors());
app.use(json());

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Bibot backend online 🤖",
  });
});

app.post("/api/chat", async (req, res) => {
  const { message } = req.body;

  console.log("Messaggio ricevuto:", message);

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");

  await askOllama(message, res);

  console.log("Risposta completata");
});

app.listen(PORT, () => {
  console.log(`Bibot backend in ascolto su http://localhost:${PORT}`);
});
