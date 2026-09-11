import express, { json } from "express";
import cors from "cors";
import { askOllama } from "../services/ollama.ts";
import * as lancedb from "@lancedb/lancedb";
import multer from "multer";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { transcribeAudio } from "../services/stt.ts";

const app = express();

const PORT = 3000;

app.use(cors());
app.use(json());

const uploadDir = path.resolve("./stt/temp");

await mkdir(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Bibot backend online 🤖",
  });
});

app.post("/api/chat", async (req, res) => {
  const { message, categories }: { message: string; categories: string[] } =
    req.body;

  console.log("Message received:", message);

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");

  await askOllama(message, categories, res);

  console.log("Completed.");
});

app.get("/api/available-docs", async (req, res) => {
  try {
    const db = await lancedb.connect("./data/lancedb");
    const table = await db.openTable("documents");

    const chunks = await table.query().toArray();

    const categories = new Set<string>();

    for (const chunk of chunks) {
      const values = chunk.categories;

      if (!values) continue;

      for (let i = 0; i < values.length; i++) {
        const category = values.get(i);

        if (category) {
          categories.add(category);
        }
      }
    }

    res.json([...categories]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Errore nel recupero delle categorie" });
  }
});

app.post("/api/stt", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({
      error: "Nessun file audio ricevuto",
    });

    return;
  }

  try {
    console.log("STT: audio ricevuto");

    const text = await transcribeAudio(req.file.path);

    console.log("STT: trascrizione completata");

    res.json({ text });
  } catch (error) {
    console.error("Errore STT:", error);

    res.status(500).json({
      error: "Errore durante la trascrizione audio",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Bibot backend listening on http://localhost:${PORT}`);
});
