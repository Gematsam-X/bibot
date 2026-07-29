import { Component, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-message-input',
  imports: [FormsModule],
  templateUrl: './message-input.html',
  styleUrl: './message-input.css',
})
export class MessageInput {
  msg = '';

  @Output() sendMessage = new EventEmitter<string>();

  triggerSendMessage() {
    this.sendMessage.emit(this.msg);
    this.msg = '';
  }
}
