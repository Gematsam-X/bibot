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
const DEFAULT_LIMIT = 8;

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
  keywords?: unknown;
  _distance: number;
}

// Promise condivisa della tabella.
// In questo modo connessione e apertura vengono fatte una sola volta.
let tablePromise: Promise<lancedb.Table> | null = null;

const QUESTION_STOP_WORDS = new Set([
  "a", "al", "alla", "che", "chi", "con", "da", "dei", "del", "della",
  "di", "dove", "e", "era", "erano", "gli", "i", "il", "in", "la",
  "le", "lo", "non", "o", "per", "quale", "quali", "sono", "su", "un",
  "una",
]);

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

function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function getSearchTerms(text: string): string[] {
  return [...new Set(
    normalizeForMatching(text)
      .split(/\s+/)
      .filter((word) => word.length >= 3 && !QUESTION_STOP_WORDS.has(word)),
  )];
}

function calculateKeywordBoost(
  question: string,
  keywords: unknown,
): number {
  const questionWords = getSearchTerms(question);

  // LanceDB può restituire le colonne lista come un oggetto iterabile,
  // non necessariamente come un Array JavaScript.
  const keywordList = Array.isArray(keywords)
    ? keywords
    : keywords && typeof (keywords as Iterable<unknown>)[Symbol.iterator] === "function"
      ? Array.from(keywords as Iterable<unknown>)
      : [];

  const keywordSet = new Set(
    keywordList
      .filter((keyword): keyword is string => typeof keyword === "string")
      .map(normalizeForMatching),
  );

  let boost = 0;

  for (const word of questionWords) {
    if (keywordSet.has(word)) {
      boost += 0.03;
    }
  }

  // Il boost non deve mai dominare la ricerca vettoriale
  return Math.min(boost, 0.15);
}

function calculateLexicalBoost(question: string, text: string): number {
  const terms = getSearchTerms(question);
  const normalizedText = normalizeForMatching(text);
  const textWords = new Set(normalizedText.split(/\s+/));

  const matchedTerms = terms.filter((term) => textWords.has(term));
  let boost = Math.min(matchedTerms.length * 0.012, 0.036);

  // Premia una relazione esplicita tra due termini specifici della domanda,
  // ad esempio "figli di Noè", senza sostituire il ranking semantico.
  for (let index = 0; index < terms.length - 1; index++) {
    const phrasePattern = new RegExp(
      `\\b${terms[index]}\\b(?:\\s+\\p{L}+){0,3}\\s+\\b${terms[index + 1]}\\b`,
      "u",
    );

    if (phrasePattern.test(normalizedText)) {
      boost += 0.08;
    }
  }

  return Math.min(boost, 0.12);
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
    const rankedResults = results
      .map((row) => ({
        ...row,
        finalScore:
          row._distance
          - calculateKeywordBoost(question, row.keywords)
          - calculateLexicalBoost(question, row.text),
      }))
      .sort((a, b) => a.finalScore - b.finalScore)
      .slice(0, limit);

    return rankedResults.map((row) => ({
      text: row.text,
      source: row.source,
      chunkIndex: row.chunkIndex,
      score: row.finalScore,
    }));
  } catch (error) {
    console.error("Errore durante il recupero dei chunk:", error);

    throw error;
  }
}
