import { Injectable } from '@angular/core';

export type ChatEvent =
  | {
      type: 'status';
      status: string;
    }
  | {
      type: 'content';
      content: string;
    };

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private apiUrl = '/api';

  async *sendMessage(
    message: string,
    categories: string[],
  ): AsyncGenerator<ChatEvent> {
    const response = await fetch(`${this.apiUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, categories }),
    });

    if (!response.ok) {
      throw new Error(`Errore HTTP: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Il server non supporta lo streaming');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');

        // L'ultima parte potrebbe essere un JSON incompleto.
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) {
            continue;
          }

          const event: ChatEvent = JSON.parse(line);

          yield event;
        }
      }

      // Gestisce eventuali dati rimasti nel buffer alla fine dello stream.
      if (buffer.trim()) {
        const event: ChatEvent = JSON.parse(buffer);

        yield event;
      }
    } finally {
      reader.releaseLock();
    }
  }

  async getAvailableDocs(): Promise<string[]> {
    const response = await fetch(`${this.apiUrl}/available-docs`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Errore HTTP: ${response.status}`);
    }

    const docs: string[] = await response.json();

    return docs;
  }
}