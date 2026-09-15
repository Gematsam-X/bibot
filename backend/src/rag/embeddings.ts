import { Ollama } from "ollama";

const ollama = new Ollama({
  host: "http://localhost:11434",
});

export async function createEmbedding(text: string) {
  const response = await ollama.embed({
    model: "nomic-embed-text",
    input: text,
    keep_alive: "30m",
    options: {
      num_thread: 2,
    },
  });

  return response.embeddings[0];
}
