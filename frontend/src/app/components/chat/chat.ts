import { Component, ChangeDetectionStrategy, Input, OnInit } from '@angular/core';
import { inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../services/chat';
import { MessageList } from '../message-list/message-list';
import { MessageInput } from '../message-input/message-input';

export interface Message {
  role: 'user' | 'bibot';
  content: string;
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
    };

    this.msgs.push(botMessage);

    try {
      // Riceve i chunk uno alla volta
      for await (const chunk of this.chatService.sendMessage(text, categories)) {
        botMessage.content += chunk;
      }
    } catch (e) {
      console.error('Errore:', e);

      botMessage.content = 'Si è verificato un errore.';
    }
  }
}
