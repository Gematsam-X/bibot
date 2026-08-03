import { Component, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-message-input',
  imports: [FormsModule],
  templateUrl: './message-input.html',
  changeDetection: ChangeDetectionStrategy.Eager,
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
