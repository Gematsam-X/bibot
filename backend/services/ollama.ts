import { Ollama } from 'ollama';

const ollama = new Ollama({
  host: 'http://localhost:11434'
});

export async function askOllama(message: string, res: any) {
  const stream = await ollama.chat({
    model: 'qwen3:30b-a3b-instruct-2507-q4_K_M',
    messages: [
      {
        role: 'user',
        content: message,
      }
    ],
    stream: true,
    "keep_alive": "30m"
  });

  for await (const chunk of stream) {
    res.write(chunk.message.content);
  }

  res.end();
}