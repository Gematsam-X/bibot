import { Component, ChangeDetectionStrategy, Input, OnInit } from '@angular/core';
import { inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../services/chat';
import { MessageList } from '../message-list/message-list';
import { MessageInput } from '../message-input/message-input';

export interface Message {
  role: 'user' | 'bibot';
  content: string;
  preLoading?: boolean;
}

@Component({
  selector: 'app-chat',
  imports: [FormsModule, MessageList, MessageInput],
  templateUrl: './chat.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './chat.css',
})
export class Chat implements OnInit {
  private chatService = inject(ChatService);

  msg = '';
  availableDocs: string[] = [];

  msgs: Message[] = [];

  ngOnInit() {
    this.getAvailableDocs();
  }

  async getAvailableDocs() {
    try {
      this.availableDocs = await this.chatService.getAvailableDocs();
    } catch (e) {
      console.error('Errore:', e);
    }
  }

  async sendMessage(message: string, categories: string[]) {
    const text = message.trim();

    if (!text) return;

    // Aggiunge il messaggio dell'utente
    this.msgs.push({
      role: 'user',
      content: text,
    });

    this.msg = '';

    // Crea subito il messaggio vuoto di Bibot
    const botMessage: Message = {
      role: 'bibot',
      content: '',
      preLoading: true,
    };

    this.msgs.push(botMessage);

    try {
      // Riceve gli eventi uno alla volta
      for await (const event of this.chatService.sendMessage(text, categories)) {
        if (event.type === 'status') {
          switch (event.status) {
            case 'retrieving':
              botMessage.content = 'Cercando nei documenti...';
              break;

            case 'loading_model':
              botMessage.content = 'Caricando il modello...';
              break;

            case 'generating':
              botMessage.content = 'Generando la risposta...';
              break;
          }

          continue;
        }

        if (event.type === 'content') {
          // Al primo contenuto reale, termina il caricamento e svuota il messaggio
          if (botMessage.preLoading) {
            botMessage.preLoading = false;
            botMessage.content = '';
          }

          // Aggiunge il testo ricevuto allo stesso messaggio
          botMessage.content += event.content;
        }
      }
    } catch (e) {
      console.error('Errore:', e);

      botMessage.preLoading = false;
      botMessage.content = 'Si è verificato un errore.';
    }
  }
}
