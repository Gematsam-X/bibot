import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { Message } from '../chat/chat';

@Component({
  selector: 'app-message-list',
  imports: [],
  templateUrl: './message-list.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './message-list.css',
})
export class MessageList {
  @Input() msgs: Message[] = [];
}
