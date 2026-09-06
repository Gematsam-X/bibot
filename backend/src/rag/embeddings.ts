import { Ollama } from 'ollama';

const ollama = new Ollama({
  host: 'http://localhost:11434'
});

// Evita il caricamento a freddo del modello tra richieste ravvicinate.
const EMBEDDING_KEEP_ALIVE = '30m';

export async function createEmbedding(text: string) {
  const response = await ollama.embed({
    model: 'nomic-embed-text',
    input: text,
    keep_alive: EMBEDDING_KEEP_ALIVE,
    options: {
      num_thread: 2
    }
  });

  return response.embeddings[0];
}
