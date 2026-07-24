import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChatService } from './services/chat';

interface Message {
	role: 'user' | 'bibot';
	content: string;
}

@Component({
	selector: 'app-root',
	imports: [FormsModule],
	templateUrl: './app.html',
	styleUrl: './app.css'
})
export class App {
	private chatService = inject(ChatService);

	msg = '';

	msgs: Message[] = [];

	inviaMessaggio() {
		const text = this.msg.trim();

		if (!text) return;

		this.msgs.push({
			role: 'user',
			content: text
		});

		this.msg = '';

		this.chatService.inviaMessaggio(text).subscribe({
			next: (data) => {
				this.msgs.push({
					role: 'bibot',
					content: data.response
				});
			},
			error: (e) => {
				console.error('Errore:', e);
			}
		});
	}
}
