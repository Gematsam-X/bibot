import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as lancedb from '@lancedb/lancedb';

import { createEmbedding } from './embeddings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_DIR = path.join(
  __dirname,
  '../../data/lancedb'
);

const TABLE_NAME = 'documents';

export interface RetrievedChunk {
  text: string;
  source: string;
  chunkIndex: number;
  score: number;
}

export async function retrieveRelevantChunks(
  question: string,
  limit: number = 5
): Promise<RetrievedChunk[]> {

  const embedding =
    await createEmbedding(question);

  const db =
    await lancedb.connect(DB_DIR);

  const table =
    await db.openTable(TABLE_NAME);

  const results =
    await table
      .search(embedding)
      .limit(limit)
      .toArray();

  return results.map((row: any) => ({
    text: row.text,
    source: row.source,
    chunkIndex: row.chunkIndex,
    score: row._distance
  }));
}