import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import * as lancedb from "@lancedb/lancedb";

import { createEmbedding } from "./embeddings.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KNOWLEDGE_DIR = path.join(__dirname, "../../knowledge");
const DB_DIR = path.join(__dirname, "../../data/lancedb");

const TABLE_NAME = "documents";

const CHUNK_SIZE = 400;
const CHUNK_OVERLAP = 10;

interface DocumentChunk {
  [key: string]: unknown;
  id: string;
  text: string;
  source: string;
  fileHash: string;
  chunkIndex: number;
  length: number;
  categories: string[];
  vector: number[];
}

/**
 * Calcola l'hash SHA-256 del contenuto.
 */
function calculateHash(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

// Pulisce il Markdown rimuovendo attributi dir="rtl", escape LaTeX inutili, separatori troppo aggressivi, spazi multipli e troppe righe vuote.

function cleanMarkdown(text: string): string {
  return (
    text
      // Rimuove attributi dir="rtl"
      .replace(/\[([^\]]+)\]\{dir="rtl"\}/g, "$1")

      // Rimuove escape LaTeX inutili
      .replace(/\\\[/g, "")
      .replace(/\\\]/g, "")

      // Sistema separatori troppo aggressivi
      .replace(/^---$/gm, "")

      // Spazi multipli
      .replace(/[ \t]+/g, " ")

      // Troppe righe vuote
      .replace(/\n{3,}/g, "\n\n")

      .trim()
  );
}

/**
 * Divide il testo in chunk sovrapposti.
 */
function splitIntoChunks(text: string): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];

  let current = "";

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;

    if (candidate.length <= CHUNK_SIZE) {
      current = candidate;
    } else {
      if (current) {
        chunks.push(current);
      }

      /*
       * Se un paragrafo è enorme,
       * lo dividiamo comunque.
       */
      if (paragraph.length > CHUNK_SIZE) {
        let start = 0;

        while (start < paragraph.length) {
          const part = paragraph.slice(start, start + CHUNK_SIZE);

          chunks.push(part.trim());

          start += CHUNK_SIZE - CHUNK_OVERLAP;
        }

        current = "";
      } else {
        current = paragraph;
      }
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

/**
 * Cerca ricorsivamente tutti i file .md
 * presenti nella cartella knowledge/.
 *
 * Esempio:
 *
 * knowledge/linux.md
 * knowledge/tecnologia/nodejs.md
 * knowledge/scuola/storia/roma.md
 */
async function getMarkdownFiles(
  directory: string = KNOWLEDGE_DIR,
): Promise<string[]> {
  const entries = await fs.readdir(directory, {
    withFileTypes: true,
  });

  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      const nestedFiles = await getMarkdownFiles(fullPath);

      files.push(...nestedFiles);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Restituisce il percorso relativo del file
 * rispetto alla cartella knowledge/.
 *
 * Esempio:
 *
 * /.../knowledge/linux/nodejs.md
 *
 * diventa:
 *
 * linux/nodejs.md
 */
function getSourcePath(filePath: string): string {
  return path.relative(KNOWLEDGE_DIR, filePath).split(path.sep).join("/");
}

/**
 * Elimina tutti i chunk appartenenti
 * a un determinato documento.
 */
async function deleteDocumentChunks(table: any, source: string) {
  const escapedSource = source.replace(/'/g, "''");

  await table.delete(`source = '${escapedSource}'`);
}

// Trova i documenti basandosi sul loro hash.

async function findDocumentByHash(table: any, fileHash: string) {
  const rows = await table
    .query()
    .where(`fileHash = '${fileHash}'`)
    .select(["source", "fileHash"])
    .toArray();

  return rows.length > 0 ? rows[0] : null;
}

// Aggiorna la fonte di un documento e dei suoi chunk, nel caso in cui il file sia stato spostato o rinominato, ma il contenuto sia rimasto invariato.

async function updateDocumentSource(
  table: any,
  oldSource: string,
  newSource: string,
) {
  const escapedOld = oldSource.replace(/'/g, "''");

  const rows = await table.query().where(`source = '${escapedOld}'`).toArray();

  for (const row of rows) {
    await table.delete(`id = '${row.id}'`);

    await table.add([
      {
        ...row,
        source: newSource,
        text: row.text.replace(`Fonte: ${oldSource}`, `Fonte: ${newSource}`),
      },
    ]);
  }
}

// Ottieni la categoria del documento basandoti sul percorso relativo del file rispetto alla cartella knowledge/.
function getCategories(source: string): string[] {
  const parts = source.split("/");

  return parts.slice(0, -1);
}

/**
 * Crea chunk ed embedding per un documento.
 */
async function createDocumentChunks(
  source: string,
  content: string,
  fileHash: string,
): Promise<DocumentChunk[]> {
  const chunks = splitIntoChunks(content);

  console.log(`   🧩 ${chunks.length} chunk`);

  const rows: DocumentChunk[] = [];

  for (let i = 0; i < chunks.length; i++) {
    console.log(`   🧠 Embedding ${i + 1}/${chunks.length}`);

    const chunkText = `Fonte: ${source}\n\n${chunks[i]}`;

    const vector = await createEmbedding(chunkText);

    rows.push({
      id: `${source}-${fileHash}-${i}`,
      text: chunkText,
      source,
      fileHash,
      categories: getCategories(source),
      chunkIndex: i,
      length: chunkText.length,
      vector,
    });
  }

  return rows;
}
/**
 * Indicizzazione incrementale ricorsiva.
 */
async function ingest() {
  console.log("📚 Avvio indicizzazione incrementale...\n");

  /*
   * Creiamo le cartelle se non esistono.
   */
  await fs.mkdir(KNOWLEDGE_DIR, {
    recursive: true,
  });

  await fs.mkdir(DB_DIR, {
    recursive: true,
  });

  /*
   * Connessione a LanceDB.
   */
  const db = await lancedb.connect(DB_DIR);

  const tables = await db.tableNames();

  let table: any;

  /*
   * =====================================================
   * PRIMO AVVIO
   * =====================================================
   */

  if (!tables.includes(TABLE_NAME)) {
    console.log("🆕 Database RAG non ancora creato.\n");

    const files = await getMarkdownFiles();

    if (files.length === 0) {
      console.log("⚠️ Nessun file .md trovato in knowledge/");

      return;
    }

    let firstRows: DocumentChunk[] | null = null;

    let firstSource = "";

    /*
     * Troviamo il primo documento
     * non vuoto per creare lo schema.
     */
    for (const file of files) {
      const source = getSourcePath(file);

      let content = await fs.readFile(file, "utf8");

      content = cleanMarkdown(content);

      if (!content.trim()) {
        console.log(`⚠️ Documento vuoto: ${source}`);

        continue;
      }

      const hash = calculateHash(content);

      console.log(`📖 Indicizzazione iniziale: ${source}`);

      firstRows = await createDocumentChunks(source, content, hash);

      firstSource = source;

      break;
    }

    if (!firstRows || firstRows.length === 0) {
      console.log("⚠️ Nessun contenuto indicizzabile.");

      return;
    }

    /*
     * Creiamo la tabella.
     */
    table = await db.createTable(TABLE_NAME, firstRows);

    console.log(`   ✅ ${firstSource} indicizzato\n`);
  } else {
    /*
     * Se la tabella esisteva già,
     * la apriamo.
     */
    table = await db.openTable(TABLE_NAME);
  }

  /*
   * =====================================================
   * STATO ATTUALE DEL DATABASE
   * =====================================================
   */

  const existingRows = await table
    .query()
    .select(["source", "fileHash"])
    .toArray();

  /*
   * source → hash
   */
  const existingHashes = new Map<string, string>();

  for (const row of existingRows) {
    if (!existingHashes.has(row.source)) {
      existingHashes.set(row.source, row.fileHash);
    }
  }

  /*
   * =====================================================
   * FILE ATTUALI
   * =====================================================
   */

  const files = await getMarkdownFiles();

  const currentFiles = new Set(files.map((file) => getSourcePath(file)));

  let added = 0;
  let updated = 0;
  let skipped = 0;
  let deleted = 0;

  /*
   * =====================================================
   * NUOVI / MODIFICATI
   * =====================================================
   */

  for (const file of files) {
    const source = getSourcePath(file);

    const content = await fs.readFile(file, "utf8");

    /*
     * Ignoriamo documenti vuoti.
     */
    if (!content.trim()) {
      console.log(`⚠️ Vuoto: ${source}`);

      continue;
    }

    const hash = calculateHash(content);

    const oldHash = existingHashes.get(source);

    /*
     * ---------------------------------------------------
     * INVARIATO
     * ---------------------------------------------------
     */

    if (oldHash === hash) {
      console.log(`⏭️  Invariato: ${source}`);

      skipped++;

      continue;
    }

    /*
     * ---------------------------------------------------
     * MODIFICATO
     * ---------------------------------------------------
     */

    if (oldHash) {
      console.log(`🔄 Modificato: ${source}`);

      await deleteDocumentChunks(table, source);

      updated++;
    } else {
      const movedDocument = await findDocumentByHash(table, hash);

      if (movedDocument) {
        console.log(`📦 Spostato: ${movedDocument.source} → ${source}`);

        await updateDocumentSource(table, movedDocument.source, source);

        skipped++;

        continue;
      }

      console.log(`🆕 Nuovo: ${source}`);

      added++;
    }

    /*
     * Creiamo i nuovi chunk.
     */
    const rows = await createDocumentChunks(source, content, hash);

    /*
     * Li aggiungiamo al database.
     */
    await table.add(rows);

    console.log(`   ✅ ${source} indicizzato\n`);
  }

  /*
   * =====================================================
   * FILE ELIMINATI
   * =====================================================
   */

  for (const source of existingHashes.keys()) {
    if (!currentFiles.has(source)) {
      console.log(`🗑️  Eliminato: ${source}`);

      await deleteDocumentChunks(table, source);

      deleted++;
    }
  }

  /*
   * =====================================================
   * RIEPILOGO
   * =====================================================
   */

  console.log("\n────────────────────────────");

  console.log("📊 Riepilogo indicizzazione");

  console.log("────────────────────────────");

  console.log(`🆕 Nuovi:       ${added}`);

  console.log(`🔄 Modificati:  ${updated}`);

  console.log(`⏭️  Invariati:   ${skipped}`);

  console.log(`🗑️  Eliminati:   ${deleted}`);

  console.log("────────────────────────────");

  console.log("✅ Indicizzazione completata!");
}

ingest().catch((error) => {
  console.error("\n❌ Errore durante l'indicizzazione:");

  console.error(error);

  process.exit(1);
});
