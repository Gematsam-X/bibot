import path from "node:path";
import { fileURLToPath } from "node:url";

import * as lancedb from "@lancedb/lancedb";

import { createEmbedding } from "./embeddings.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directory del database LanceDB
const DB_DIR = path.resolve(__dirname, "../../data/lancedb");

// Nome della tabella contenente i chunk
const TABLE_NAME = "documents";

// Numero di risultati restituiti di default
const DEFAULT_LIMIT = 5;

export interface RetrievedChunk {
  text: string;
  source: string;
  chunkIndex: number;
  score: number;
}

// Struttura di una riga restituita da LanceDB
interface LanceChunkRow {
  text: string;
  source: string;
  chunkIndex: number;
  _distance: number;
}

// Promise condivisa della tabella.
// In questo modo connessione e apertura vengono fatte una sola volta.
let tablePromise: Promise<lancedb.Table> | null = null;

async function getTable(): Promise<lancedb.Table> {
  if (!tablePromise) {
    tablePromise = (async () => {
      const db = await lancedb.connect(DB_DIR);
      return db.openTable(TABLE_NAME);
    })();

    try {
      await tablePromise;
    } catch (error) {
      tablePromise = null;
      throw error;
    }
  }

  return tablePromise;
}

export async function retrieveRelevantChunks(
  question: string,
  limit: number = DEFAULT_LIMIT,
): Promise<RetrievedChunk[]> {
  try {
    // Calcola l'embedding della domanda
    const embedding = await createEmbedding(question);

    // Ottiene la tabella già aperta
    const table = await getTable();

    // Esegue la ricerca vettoriale
    const results = (await table
      .search(embedding)
      .limit(limit)
      .toArray()) as LanceChunkRow[];

    // Converte il risultato nel formato usato dall'applicazione
    return results.map((row) => ({
      text: row.text,
      source: row.source,
      chunkIndex: row.chunkIndex,
      score: row._distance,
    }));
  } catch (error) {
    console.error("Errore durante il recupero dei chunk:", error);

    throw error;
  }
}
