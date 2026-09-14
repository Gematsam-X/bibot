import { ChangeDetectionStrategy, Component, inject, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { ChatService } from "../../services/chat";
import { MessageInput } from "../message-input/message-input";
import { MessageList } from "../message-list/message-list";

export interface Message {
  role: "user" | "bibot";
  content: string;
  preLoading?: boolean;
  categories?: string[];
  isComplete?: boolean;
}

@Component({
  selector: "app-chat",
  imports: [FormsModule, MessageList, MessageInput],
  templateUrl: "./chat.html",
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: "./chat.css",
})
export class Chat implements OnInit {
  private chatService = inject(ChatService);

  msg = "";
  availableDocs: string[] = [];
  msgs: Message[] = [];

  ngOnInit(): void {
    this.getAvailableDocs();
  }

  async getAvailableDocs(): Promise<void> {
    try {
      this.availableDocs = await this.chatService.getAvailableDocs();
    } catch (error) {
      console.error("Errore:", error);
    }
  }

  async sendMessage(message: string, categories: string[]): Promise<void> {
    const text = message.trim();

    if (!text) {
      return;
    }

    this.msgs.push({
      role: "user",
      content: text,
      categories: [...categories],
    });

    this.msg = "";

    await this.generateResponse(text, categories);
  }

  private async generateResponse(
    text: string,
    categories: string[],
    index?: number,
  ): Promise<void> {
    // Crea il messaggio vuoto di Bibot.
    const botMessage: Message = {
      role: "bibot",
      content: "",
      preLoading: true,
      isComplete: false,
    };

    // Se è stato specificato un indice,
    // inserisce il messaggio esattamente lì.
    if (index !== undefined) {
      this.msgs.splice(index, 0, botMessage);
    } else {
      // Altrimenti lo aggiunge normalmente alla fine.
      this.msgs.push(botMessage);
    }

    try {
      for await (const event of this.chatService.sendMessage(text, categories)) {
        if (event.type === "status") {
          switch (event.status) {
            case "retrieving":
              botMessage.content = "Cercando nei documenti...";
              break;

            case "loading_model":
              botMessage.content = "Caricando il modello...";
              break;

            case "generating":
              botMessage.content = "Generando la risposta...";
              break;
          }

          continue;
        }

        if (event.type === "content") {
          // Al primo contenuto reale termina il caricamento.
          if (botMessage.preLoading) {
            botMessage.preLoading = false;
            botMessage.content = "";
          }

          // Aggiunge il contenuto ricevuto.
          botMessage.content += event.content;
        }
      }
    } catch (error) {
      console.error("Errore durante la generazione:", error);

      botMessage.preLoading = false;
      botMessage.content = "Si è verificato un errore.";
    } finally {
      botMessage.preLoading = false;
      botMessage.isComplete = true;
    }
  }

  async regenerateMessage(message: Message): Promise<void> {
    if (message.role !== "bibot") {
      return;
    }

    // Trova l'indice della vecchia risposta.
    const botIndex = this.msgs.indexOf(message);

    if (botIndex === -1) {
      return;
    }

    // Il messaggio precedente deve essere quello dell'utente.
    const userIndex = botIndex - 1;

    if (userIndex < 0) {
      return;
    }

    const userMessage = this.msgs[userIndex];

    if (userMessage.role !== "user") {
      return;
    }

    const text = userMessage.content.trim();
    const categories = [...(userMessage.categories ?? [])];

    if (!text) {
      return;
    }

    // Elimina la vecchia risposta.
    this.msgs.splice(botIndex, 1);

    // Genera la nuova risposta nello stesso identico posto.
    await this.generateResponse(text, categories, botIndex);
  }
}
