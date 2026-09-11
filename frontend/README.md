# Bibot

Bibot è un chatbot locale progettato per aiutare i Testimoni di Geova e altri nella ricerca di informazioni utilizzando la Bibbia e le pubblicazioni presenti nella propria base documentale.

Il progetto utilizza un modello linguistico locale tramite Ollama e un sistema RAG per recuperare le informazioni pertinenti prima della generazione della risposta.

## Tecnologie

- Angular
- Node.js
- TypeScript
- Ollama
- LanceDB

## Modello

Bibot utilizza il modello:

```text
qwen3:30b-a3b-instruct-2507-q4_K_M
```

Il modello viene eseguito tramite Ollama.

Ollama viene utilizzato localmente all'indirizzo:

```text
http://localhost:11434
```

## RAG

Bibot utilizza LanceDB per la ricerca dei contenuti documentali.

Il database LanceDB si trova in:

```text
./data/lancedb
```

La tabella utilizzata è:

```text
documents
```

Il sistema recupera i contenuti pertinenti alla domanda dell'utente e li utilizza per costruire il contesto fornito al modello.

Attualmente il sistema recupera 64 chunk, li sottopone a reranking e utilizza gli 8 risultati finali per la generazione della risposta.

## Documenti

I documenti utilizzati dal RAG sono organizzati nelle categorie disponibili al sistema.

La categoria `bible` è separata dalle pubblicazioni.

Le pubblicazioni comprendono le relative sottocategorie, tra cui `cour` e `pers`.

È possibile combinare le categorie, ad esempio utilizzando contemporaneamente la Bibbia e le pubblicazioni.

## Generazione delle risposte

Il modello viene istruito a utilizzare esclusivamente i documenti forniti dal sistema RAG.

Bibot è configurato per:

- includere riferimenti biblici quando possibile;
- non inventare informazioni o fonti;
- non utilizzare conoscenze proprie per completare informazioni mancanti;
- indicare quando i documenti forniti non contengono informazioni sufficienti per rispondere.

## Streaming

La risposta di Bibot viene trasmessa progressivamente al frontend.

Il backend invia eventi JSON separati da newline.

Gli eventi possono rappresentare:

```json
{"type":"status","status":"retrieving"}
```

```json
{"type":"status","status":"loading_model"}
```

```json
{"type":"status","status":"generating"}
```

oppure contenere una parte della risposta:

```json
{"type":"content","content":"Testo della risposta"}
```

Il frontend utilizza questi eventi per aggiornare l'interfaccia durante l'elaborazione della richiesta.

## Stato dell'elaborazione

Durante una richiesta Bibot può mostrare le diverse fasi dell'elaborazione:

```text
Cerco nei documenti...
        ↓
Carico il modello...
        ↓
Genero la risposta...
        ↓
Risposta in streaming
```

Il controllo dello stato del modello viene effettuato tramite Ollama.

## Frontend

Il frontend è sviluppato con Angular e utilizza componenti standalone.

La chat gestisce:

- messaggi dell'utente;
- messaggi di Bibot;
- stato di caricamento;
- stato delle varie fasi della richiesta;
- risposta generata progressivamente.

## Backend

Il backend è sviluppato in TypeScript e utilizza Ollama per la generazione delle risposte.

Il backend gestisce il processo:

```text
Domanda dell'utente
        ↓
Ricerca RAG
        ↓
Reranking
        ↓
Selezione dei documenti
        ↓
Creazione del contesto
        ↓
Ollama
        ↓
Streaming della risposta
```

## Struttura del progetto

Il progetto contiene il frontend Angular, il backend e i dati utilizzati dal sistema RAG.

Il database LanceDB utilizzato dal RAG si trova in:

```text
data/lancedb
```

La struttura precisa delle altre directory non viene descritta qui per evitare di documentare percorsi non verificati.