import path from "node:path";
import { fileURLToPath } from "node:url";
import * as lancedb from "@lancedb/lancedb";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_DIR = path.resolve(__dirname, "../../data/lancedb");

const TABLE_NAME = "documents";

async function check() {
  const db = await lancedb.connect(DB_DIR);

  const table = await db.openTable(TABLE_NAME);

  const rows = await table
    .query()
    .select(["source", "chunkIndex", "keywords", "text"])
    .limit(10)
    .toArray();

  for (const row of rows) {
    console.log("\n====================");
    console.log("Fonte:", row.source);
    console.log("Chunk:", row.chunkIndex);
    console.log("Keywords:", Array.from(row.keywords ?? []));
    console.log("Testo:");
    console.log(row.text.slice(0, 300));
  }
}

check().catch(console.error);
