import { Component } from '@angular/core';
import { inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../services/chat';
import { MessageList } from "../message-list/message-list";
import { MessageInput } from "../message-input/message-input";

export interface Message {
  role: 'user' | 'bibot';
  content: string;
}

@Component({
  selector: 'app-chat',
  imports: [FormsModule, MessageList, MessageInput],
  templateUrl: './chat.html',
  styleUrl: './chat.css',
})
export class Chat {
  private chatService = inject(ChatService);

  msg = '';

  msgs: Message[] = [];

    sendMessage(message: string) {
    const text = message.trim();

    if (!text) return;

    this.msgs.push({
      role: 'user',
      content: text,
    });

    this.msg = '';

    this.chatService.sendMessage(text).subscribe({
      next: (data) => {
        this.msgs.push({
          role: 'bibot',
          content: data.response,
        });
      },
      error: (e) => {
        console.error('Errore:', e);
      },
    });
  }
}
