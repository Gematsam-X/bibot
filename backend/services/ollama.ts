import { Ollama } from "ollama";
import { retrieveRelevantChunks } from "../src/rag/retriever.ts";

const ollama = new Ollama({
  host: "http://localhost:11434",
});

const model = "qwen3:30b-a3b-instruct-2507-q4_K_M";

function sendStatus(res: any, status: string) {
  res.write(
    JSON.stringify({
      type: "status",
      status,
    }) + "\n",
  );
}

function sendContent(res: any, content: string) {
  res.write(
    JSON.stringify({
      type: "content",
      content,
    }) + "\n",
  );
}

export async function askOllama(
  message: string,
  categories: string[],
  res: any,
) {
  const startTime = Date.now();

  console.log("\n==============================");
  console.log("🤖 Nuova richiesta Bibot");
  console.log("==============================");
  console.log("📩 Messaggio utente:");
  console.log(message);

  try {
    // ==========================
    // RETRIEVER
    // ==========================

    console.log("\n🔎 Avvio ricerca RAG...");

    sendStatus(res, "retrieving");

    const ragStart = Date.now();

    const chunks = await retrieveRelevantChunks(message, categories, 8);

    console.log(`✅ Chunk recuperati: ${chunks.length}`);

    console.log(`⏱️ Tempo retriever: ${Date.now() - ragStart}ms`);

    chunks.forEach((chunk, index) => {
      console.log("\n--- Chunk", index + 1, "---");
      console.log("📄 Fonte:", chunk.source);
      console.log("🔢 Indice:", chunk.chunkIndex);
      console.log("📊 Score:", chunk.score);
      console.log("📝 Il chunk dice:", chunk.text);
    });

    // ==========================
    // CREAZIONE CONTESTO
    // ==========================

    console.log("\n📝 Creazione contesto...");

    const context = chunks
      .map(
        (chunk, index) =>
          `
    [Documento ${index + 1}]
    Fonte: ${chunk.source}

    ${chunk.text}
    `,
      )
      .join("\n");

    console.log("📏 Lunghezza contesto:", context.length, "caratteri");

    // ==========================
    // CHIAMATA OLLAMA
    // ==========================

    console.log("\n🧠 Invio richiesta a Ollama...");

    const ollamaStart = Date.now();

    const chatPromise = ollama.chat({
      model: model,

      messages: [
        {
          role: "system",
          content: `Sei Bibot, un assistente pensato per aiutare i Testimoni di Geova a trovare informazioni.
          Includi riferimenti biblici quando possibile.
          Nel caso di una riposta più lunga, includi UNA SOLA sintesi alla fine della risposta.
          Rispondi usando solo i documenti forniti. Non inventare informazioni o fonti.
          Non dire in nessun caso "Documento 1", "Documento 7" o in generale "Documento" seguito da un numero.
          Se i documenti non contengono informazioni sufficienti per rispondere, non dedurre, completare o ricostruire la risposta usando conoscenze proprie.
          Rispondi invece che non sono state trovate informazioni sufficienti nei documenti forniti.`,
        },

        {
          role: "user",
          content: `Contesto dai documenti:
          ${context}

          Domanda dell'utente:
          ${message}`,
        },
      ],

      stream: true,
      keep_alive: "30m",
      think: false,
      options: {
        temperature: 0.34,
      },
    });

    const running = await ollama.ps();

    const modelLoaded = running.models.some(
      (runningModel) => runningModel.name === model,
    );

    if (!modelLoaded) {
      sendStatus(res, "loading_model");

      while (true) {
        const running = await ollama.ps();

        const loaded = running.models.some(
          (runningModel) => runningModel.name === model,
        );

        if (loaded) {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    sendStatus(res, "generating");

    const stream = await chatPromise;

    console.log("✅ Stream Ollama iniziato");

    console.log(
      `⏱️ Tempo prima risposta Ollama: ${Date.now() - ollamaStart}ms`,
    );

    // ==========================
    // STREAM RISPOSTA
    // ==========================

    let tokenCount = 0;

    console.log("\n📤 Streaming risposta...\n");

    for await (const chunk of stream) {
      const content = chunk.message.content;

      if (content) {
        tokenCount++;

        console.log(`TOKEN ${tokenCount}:`, content);

        sendContent(res, content);
      }
    }

    console.log("\n✅ Streaming completato");

    console.log("🔢 Token ricevuti:", tokenCount);

    console.log("⏱️ Tempo totale:", Date.now() - startTime, "ms");

    res.end();
  } catch (error) {
    console.error("\n❌ ERRORE BIBOT");

    console.error(error);

    if (!res.headersSent) {
      res.status(500);
    }

    res.write("\n\n❌ Errore durante la generazione della risposta.");

    res.end();
  }
}
