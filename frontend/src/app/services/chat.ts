import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private apiUrl = 'http://localhost:3000/api';

  async *sendMessage(message: string, categories: string[]): AsyncGenerator<string> {
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

    try {
      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          break;
        }

        yield decoder.decode(value, { stream: true });
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
