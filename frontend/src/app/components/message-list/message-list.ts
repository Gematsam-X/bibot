import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { marked } from 'marked';
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

  renderMarkdown(content: string): string {
    return marked.parse(content) as string;
  }
}