import { Ollama } from "ollama";
import { retrieveRelevantChunks } from "../src/rag/retriever.ts";

const ollama = new Ollama({
  host: "http://localhost:11434",
});

export async function askOllama(message: string, res: any) {
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

    const ragStart = Date.now();

    const chunks = await retrieveRelevantChunks(message, 3);

    console.log(`✅ Chunk recuperati: ${chunks.length}`);

    console.log(`⏱️ Tempo retriever: ${Date.now() - ragStart}ms`);

    chunks.forEach((chunk, index) => {
      console.log("\n--- Chunk", index + 1, "---");
      console.log("📄 Fonte:", chunk.source);
      console.log("🔢 Indice:", chunk.chunkIndex);
      console.log("📊 Score:", chunk.score);
      console.log("📝 Anteprima:", chunk.text.slice(0, 200));
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

    const stream = await ollama.chat({
      model: "qwen3:30b-a3b-instruct-2507-q4_K_M",

      messages: [
        {
          role: "system",
          content: `Sei Bibot, un assistente pensato per aiutare i Testimoni di Geova a trovare informazioni.
Rispondi usando solo il contesto fornito. Se manca la risposta, dillo chiaramente, dicendo che non hai abbastanza informazioni per rispondere.`,
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
        temperature: 0.3,
      },
    });

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

        res.write(content);
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

// export async function askOllama(message: string, res: any) {
//   console.log("\n==============================");
//   console.log("🤖 Richiesta diretta a Ollama");
//   console.log("==============================");

//   console.log("📩 Messaggio:");
//   console.log(message);

//   try {
//     console.log("\n🧠 Invio a Qwen3-30B...");

//     const startTime = Date.now();

//     const stream = await ollama.chat({
//       model: "qwen3:30b-a3b-instruct-2507-q4_K_M",

//       messages: [
//         {
//           role: "system",
//           content: `Sei Bibot, un assistente intelligente.
// Rispondi in modo chiaro, utile e naturale.
// `,
//         },

//         {
//           role: "user",
//           content: message,
//         },
//       ],

//       stream: true,

//       "keep_alive": "30m",

//       think: false,
//       options: {
//         temperature: 0.3,
//         num_predict: 2000,
//       },
//     });

//     console.log("✅ Stream iniziato");

//     console.log("⏱️ Tempo risposta iniziale:", Date.now() - startTime, "ms");

//     let tokens = 0;

//     for await (const chunk of stream) {
//       const text = chunk.message.content;

//       if (text) {
//         tokens++;

//         console.log(`TOKEN ${tokens}:`, text);

//         res.write(text);
//       }
//     }

//     console.log("\n✅ Completato");

//     console.log("🔢 Token:", tokens);

//     console.log("⏱️ Tempo totale:", Date.now() - startTime, "ms");

//     res.end();
//   } catch (error) {
//     console.error("❌ Errore Ollama:");

//     console.error(error);

//     if (!res.headersSent) {
//       res.status(500);
//     }

//     res.write("\nErrore durante la generazione.");

//     res.end();
//   }
// }
