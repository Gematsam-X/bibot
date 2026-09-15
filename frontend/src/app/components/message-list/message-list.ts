import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
} from "@angular/core";

import { marked } from "marked";

import { Message } from "../chat/chat";

import { faCheck, faCopy, faRedo, faShare } from "@fortawesome/free-solid-svg-icons";

import { faTelegram, faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import { faEnvelope } from "@fortawesome/free-solid-svg-icons";

import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";

@Component({
  selector: "app-message-list",
  imports: [FontAwesomeModule],
  templateUrl: "./message-list.html",
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: "./message-list.css",
})
export class MessageList implements OnDestroy {
  @Input() msgs: Message[] = [];

  @Output() regenerate = new EventEmitter<Message>();

  copyIcon = faCopy;
  shareIcon = faShare;
  regenerateIcon = faRedo;

  whatsappIcon = faWhatsapp;
  telegramIcon = faTelegram;
  emailIcon = faEnvelope;

  actionsVisible = false;

  // Message currently being shared.
  shareContent: string | null = null;

  private hideActionsTimeout?: ReturnType<typeof setTimeout>;

  renderMarkdown(content: string): string {
    return marked.parse(content) as string;
  }

  @HostListener("document:mousemove")
  onMouseMove(): void {
    this.actionsVisible = true;

    this.clearHideActionsTimeout();

    this.hideActionsTimeout = setTimeout(() => {
      this.actionsVisible = false;
    }, 2000);
  }

  private clearHideActionsTimeout(): void {
    if (this.hideActionsTimeout) {
      clearTimeout(this.hideActionsTimeout);
      this.hideActionsTimeout = undefined;
    }
  }

  async copyMessage(content: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(content);
      this.copyIcon = faCheck; // Change the icon to indicate success
      window.setTimeout(() => {
        this.copyIcon = faCopy; // Revert back to the original icon after 2 seconds
      }, 2000);
    } catch (error) {
      console.error("Unable to copy message:", error);
    }
  }

  async shareMessage(content: string): Promise<void> {
    try {
      // Use the native share dialog when supported.
      if (navigator.share) {
        await navigator.share({
          text: content,
        });

        return;
      }

      // Desktop fallback.
      this.shareContent = content;
    } catch (error) {
      // Closing the native share dialog is not an error.
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      console.error("Unable to share message:", error);
    }
  }

  closeShareMenu(): void {
    this.shareContent = null;
  }

  async shareCopy(): Promise<void> {
    if (!this.shareContent) {
      return;
    }

    await this.copyMessage(this.shareContent);
    this.closeShareMenu();
  }

  shareWhatsApp(): void {
    if (!this.shareContent) {
      return;
    }

    const text = encodeURIComponent(this.shareContent);

    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");

    this.closeShareMenu();
  }

  shareTelegram(): void {
    if (!this.shareContent) {
      return;
    }

    const text = encodeURIComponent(this.shareContent);

    window.open(`https://t.me/share/url?text=${text}`, "_blank", "noopener,noreferrer");

    this.closeShareMenu();
  }

  shareEmail(): void {
    if (!this.shareContent) {
      return;
    }

    const subject = encodeURIComponent("Chat con Bibot");
    const body = encodeURIComponent(this.shareContent);

    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank", "noopener,noreferrer");

    this.closeShareMenu();
  }

  @HostListener("document:keydown.escape")
  onEscape(): void {
    this.closeShareMenu();
  }

  regenerateMessage(message: Message): void {
    this.regenerate.emit(message);
  }

  ngOnDestroy(): void {
    this.clearHideActionsTimeout();
  }
}
