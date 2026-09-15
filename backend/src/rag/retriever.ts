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

// Numero di risultati restituiti al modello
const DEFAULT_LIMIT = 8;

// Numero minimo di candidati da valutare prima del ranking finale
const MIN_CANDIDATE_LIMIT = 50;

// Numero di candidati semantici rispetto al numero finale richiesto
const CANDIDATE_MULTIPLIER = 8;

// Lunghezza minima per considerare una parola un termine distintivo
const MIN_LEXICAL_TERM_LENGTH = 7;

// Numero massimo di termini distintivi usati dal fallback lessicale
const MAX_LEXICAL_TERMS = 3;

// Bonus massimo per una corrispondenza lessicale diretta
const LEXICAL_FALLBACK_BOOST = 0.08;

// Bonus massimo derivante dalle keywords
const MAX_KEYWORD_BOOST = 0.15;

// Bonus massimo derivante dalle corrispondenze testuali
const MAX_LEXICAL_BOOST = 0.12;

// Parole che non portano informazioni utili per il retrieval.
const QUESTION_STOP_WORDS = new Set([
  "a",
  "ad",
  "al",
  "alla",
  "alle",
  "agli",
  "ai",
  "alcuni",
  "alcune",
  "alcuno",
  "alcuna",
  "alcun",
  "pure",
  "anche",
  "che",
  "chi",
  "come",
  "con",
  "da",
  "dal",
  "dalla",
  "dalle",
  "degli",
  "dei",
  "del",
  "della",
  "delle",
  "di",
  "dove",
  "e",
  "era",
  "erano",
  "essere",
  "gli",
  "i",
  "il",
  "in",
  "la",
  "le",
  "lo",
  "ma",
  "nei",
  "nel",
  "nella",
  "nelle",
  "non",
  "o",
  "per",
  "quale",
  "quali",
  "quando",
  "quanto",
  "sono",
  "su",
  "un",
  "una",
  "uno",
]);

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
  categories?: unknown;
  _distance: number;
}

interface CandidateChunkRow extends LanceChunkRow {
  lexicalMatches?: string[];
}

/**
 * Promise condivisa della tabella.
 *
 * In questo modo connessione e apertura della tabella
 * vengono effettuate una sola volta.
 */
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

/**
 * Normalizza il testo per i confronti lessicali.
 *
 * Esempio:
 *
 * "Matusalèmme!" → "matusalemme"
 */
function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Estrae i termini significativi dalla domanda.
 */
function getSearchTerms(text: string): string[] {
  return [
    ...new Set(
      normalizeForMatching(text)
        .split(/\s+/)
        .filter((word) => word.length >= 3 && !QUESTION_STOP_WORDS.has(word)),
    ),
  ];
}

/**
 * Restituisce i termini distintivi che possono essere
 * utilizzati per il fallback lessicale.
 *
 * I termini generici come "precisamente" vengono esclusi.
 *
 * Esempio:
 *
 * "In quali anni visse precisamente Matusalemme?"
 *
 * diventa:
 *
 * ["matusalemme"]
 */
function getLexicalFallbackTerms(question: string): string[] {
  return getSearchTerms(question)
    .filter(
      (term) =>
        term.length >= MIN_LEXICAL_TERM_LENGTH && !term.endsWith("mente"),
    )
    .sort((first, second) => {
      return second.length - first.length;
    })
    .slice(0, MAX_LEXICAL_TERMS);
}

/**
 * Costruisce il filtro delle categorie per LanceDB.
 */
function buildCategoryFilter(
  categories: string[] | string,
): string | undefined {
  const categoryList = Array.isArray(categories) ? categories : [categories];

  const normalizedCategories = categoryList
    .map((category) => category.trim().toLowerCase())
    .filter(Boolean);

  if (normalizedCategories.length === 0) {
    return undefined;
  }

  const escapedCategories = normalizedCategories.map(
    (category) => `'${category.replace(/'/g, "''")}'`,
  );

  return `array_has_any(categories, [${escapedCategories.join(", ")}])`;
}

/**
 * Cerca chunk che contengono almeno uno dei termini distintivi.
 *
 * A differenza del vecchio sistema, non viene scelto un solo
 * termine lessicale.
 */
async function retrieveLexicalCandidates(
  table: lancedb.Table,
  question: string,
  limit: number,
  categoryFilter?: string,
): Promise<LanceChunkRow[]> {
  const terms = getLexicalFallbackTerms(question);

  if (terms.length === 0) {
    return [];
  }

  console.log("🔤 Termini lessicali:", terms);

  const textConditions = terms.map((term) => `LOWER(text) LIKE '%${term}%'`);

  const lexicalCondition =
    textConditions.length === 1
      ? textConditions[0]
      : `(${textConditions.join(" OR ")})`;

  const whereClause = categoryFilter
    ? `${lexicalCondition} AND ${categoryFilter}`
    : lexicalCondition;

  return (await table
    .query()
    .where(whereClause)
    .select(["text", "source", "chunkIndex", "keywords", "categories"])
    .limit(limit)
    .toArray()) as LanceChunkRow[];
}

/**
 * Calcola il bonus derivante dalle keywords associate al chunk.
 */
function calculateKeywordBoost(question: string, keywords: unknown): number {
  const questionWords = getSearchTerms(question);

  const keywordList = Array.isArray(keywords)
    ? keywords
    : keywords &&
        typeof (keywords as Iterable<unknown>)[Symbol.iterator] === "function"
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

  return Math.min(boost, MAX_KEYWORD_BOOST);
}

/**
 * Trova quali termini della domanda sono effettivamente
 * presenti nel testo del chunk.
 */
function getMatchedLexicalTerms(question: string, text: string): string[] {
  const terms = getSearchTerms(question);
  const normalizedText = normalizeForMatching(text);
  const textWords = new Set(normalizedText.split(/\s+/));

  return terms.filter((term) => textWords.has(term));
}

/**
 * Calcola il bonus per la presenza di termini della domanda
 * all'interno del testo del chunk.
 */
function calculateLexicalBoost(question: string, text: string): number {
  const terms = getSearchTerms(question);
  const normalizedText = normalizeForMatching(text);
  const textWords = new Set(normalizedText.split(/\s+/));

  const matchedTerms = terms.filter((term) => textWords.has(term));

  let boost = Math.min(matchedTerms.length * 0.012, 0.036);

  /**
   * Premia una relazione ravvicinata tra due termini distintivi.
   *
   * Esempio:
   *
   * "figli di Noè"
   *
   * viene favorito rispetto a un testo che contiene
   * solamente "figli" molto lontano da "Noè".
   */
  for (let index = 0; index < terms.length - 1; index++) {
    const firstTerm = terms[index];
    const secondTerm = terms[index + 1];

    const phrasePattern = new RegExp(
      `\\b${firstTerm}\\b(?:\\s+\\p{L}+){0,3}\\s+\\b${secondTerm}\\b`,
      "u",
    );

    if (phrasePattern.test(normalizedText)) {
      boost += 0.08;
    }
  }

  return Math.min(boost, MAX_LEXICAL_BOOST);
}

/**
 * Calcola quanto un chunk è direttamente collegato
 * ai termini distintivi della domanda.
 */
function calculateDistinctiveTermBoost(question: string, text: string): number {
  const lexicalTerms = getLexicalFallbackTerms(question);

  if (lexicalTerms.length === 0) {
    return 0;
  }

  const normalizedText = normalizeForMatching(text);

  let boost = 0;

  for (const term of lexicalTerms) {
    const pattern = new RegExp(`\\b${term}\\b`, "u");

    if (pattern.test(normalizedText)) {
      boost += 0.06;
    }
  }

  return Math.min(boost, 0.18);
}

export async function retrieveRelevantChunks(
  question: string,
  selectedCategories: string[],
  limit: number = DEFAULT_LIMIT,
): Promise<RetrievedChunk[]> {
  try {
    console.log("\n🔎 Avvio ricerca RAG...");

    // Mostra i termini distintivi che verranno usati
    // dal ramo lessicale.
    const lexicalTerms = getLexicalFallbackTerms(question);

    console.log("🔤 Termini distintivi:", lexicalTerms);

    // Calcola l'embedding della domanda.
    const embedding = await createEmbedding(question);

    // Ottiene la tabella già aperta.
    const table = await getTable();

    /**
     * Recuperiamo molti più candidati rispetto al numero
     * finale richiesto.
     *
     * Con limit = 8:
     *
     * 8 × 8 = 64 candidati
     */
    const candidateLimit = Math.max(
      limit * CANDIDATE_MULTIPLIER,
      MIN_CANDIDATE_LIMIT,
    );

    console.log(`📚 Candidati richiesti: ${candidateLimit}`);

    console.log("Categorie selezionate:", selectedCategories);

    const categoryFilter = buildCategoryFilter(selectedCategories);

    console.log("Filtro LanceDB:", categoryFilter);

    const semanticQuery = table.search(embedding);

    if (categoryFilter) {
      semanticQuery.where(categoryFilter);
    }

    /**
     * Eseguiamo contemporaneamente:
     *
     * 1. ricerca semantica
     * 2. ricerca lessicale
     */
    const [semanticResults, lexicalResults] = await Promise.all([
      semanticQuery.limit(candidateLimit).toArray() as Promise<LanceChunkRow[]>,

      retrieveLexicalCandidates(
        table,
        question,
        candidateLimit,
        categoryFilter,
      ),
    ]);

    console.log(`🧠 Candidati semantici: ${semanticResults.length}`);

    console.log(`🔤 Candidati lessicali: ${lexicalResults.length}`);

    /**
     * Troviamo la distanza semantica migliore.
     *
     * I risultati trovati solamente tramite ricerca lessicale
     * vengono inseriti poco dopo i migliori risultati semantici.
     */
    const bestSemanticDistance = semanticResults.reduce(
      (distance, row) => Math.min(distance, row._distance),
      Number.POSITIVE_INFINITY,
    );

    const lexicalBaseDistance = Number.isFinite(bestSemanticDistance)
      ? bestSemanticDistance + 0.04
      : 1;

    const candidates = new Map<string, CandidateChunkRow>();

    /**
     * Inserisce i risultati semantici.
     */
    for (const row of semanticResults) {
      candidates.set(`${row.source}:${row.chunkIndex}`, {
        ...row,
        lexicalMatches: [],
      });
    }

    /**
     * Inserisce anche i risultati trovati tramite ricerca
     * lessicale.
     */
    for (const row of lexicalResults) {
      const key = `${row.source}:${row.chunkIndex}`;

      const semanticRow = candidates.get(key);

      if (semanticRow) {
        semanticRow.lexicalMatches = getMatchedLexicalTerms(question, row.text);
      } else {
        candidates.set(key, {
          ...row,
          _distance: lexicalBaseDistance,
          lexicalMatches: getMatchedLexicalTerms(question, row.text),
        });
      }
    }

    console.log(`🔀 Candidati dopo merge: ${candidates.size}`);

    /**
     * Ranking ibrido.
     *
     * Score più basso = risultato migliore.
     */
    const rankedResults = [...candidates.values()]
      .map((row) => {
        const keywordBoost = calculateKeywordBoost(question, row.keywords);

        const lexicalBoost = calculateLexicalBoost(question, row.text);

        const distinctiveBoost = calculateDistinctiveTermBoost(
          question,
          row.text,
        );

        const lexicalFallbackBoost =
          row.lexicalMatches && row.lexicalMatches.length > 0
            ? LEXICAL_FALLBACK_BOOST
            : 0;

        const finalScore =
          row._distance -
          keywordBoost -
          lexicalBoost -
          distinctiveBoost -
          lexicalFallbackBoost;

        return {
          ...row,
          finalScore,
          keywordBoost,
          lexicalBoost,
          distinctiveBoost,
          lexicalFallbackBoost,
        };
      })
      .sort((first, second) => first.finalScore - second.finalScore)
      .slice(0, limit);

    /**
     * Log dettagliato dei risultati finali.
     *
     * Questo è particolarmente utile per capire
     * perché un chunk è stato scelto.
     */
    console.log("\n🎯 Risultati finali:");

    rankedResults.forEach((row, index) => {
      console.log(`\n--- Chunk ${index + 1} ---`);

      console.log(`📄 Fonte: ${row.source}`);

      console.log(`🔢 Indice: ${row.chunkIndex}`);

      console.log(`📊 Distanza semantica: ${row._distance}`);

      console.log(`🔤 Match lessicali:`, row.lexicalMatches);

      console.log(`🏷️ Keyword boost: ${row.keywordBoost}`);

      console.log(`📝 Lexical boost: ${row.lexicalBoost}`);

      console.log(`🎯 Distinctive boost: ${row.distinctiveBoost}`);

      console.log(`⚡ Fallback boost: ${row.lexicalFallbackBoost}`);

      console.log(`🏆 Score finale: ${row.finalScore}`);

      console.log(`📝 ${row.text.slice(0, 500)}`);
    });

    console.log(`\n✅ Chunk finali: ${rankedResults.length}`);

    return rankedResults.map((row) => ({
      text: row.text,
      source: row.source,
      chunkIndex: row.chunkIndex,
      score: row.finalScore,
    }));
  } catch (error) {
    console.error("❌ Errore durante il recupero dei chunk:", error);

    throw error;
  }
}
