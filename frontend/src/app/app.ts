import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChatService } from './services/chat';
import { Chat } from './components/chat/chat';
import { RouterOutlet } from '@angular/router';

@Component({
	selector: 'app-root',
	imports: [FormsModule, RouterOutlet, Chat],
	templateUrl: './app.html',
	styleUrls: ['./app.css']
})
export class App {
}
