import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';
import { Chat } from './components/chat/chat';

@Component({
	selector: 'app-root',
	imports: [FormsModule, RouterOutlet, Chat],
	templateUrl: './app.html',
	changeDetection: ChangeDetectionStrategy.Eager,
	styleUrls: ['./app.css']
})
export class App {
}
