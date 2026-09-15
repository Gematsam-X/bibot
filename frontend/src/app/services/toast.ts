import { Injectable } from "@angular/core";

@Injectable({
  providedIn: "root",
})
export class ToastService {
  private toastElement: HTMLElement | null = null;
  private hideTimeout: ReturnType<typeof setTimeout> | null = null;

  showToast(message: string, duration?: number): void {
    this.removeToast();

    const calculatedDuration = Math.min(Math.max(1500 + message.length * 45, 2000), 6000);

    const toastDuration = duration ?? calculatedDuration;

    const toast = document.createElement("div");
    toast.className = "toast";

    const content = document.createElement("span");
    content.className = "toast-message";
    content.textContent = message;

    const closeButton = document.createElement("button");
    closeButton.className = "toast-close";
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Chiudi");
    closeButton.textContent = "×";

    closeButton.addEventListener("click", () => {
      this.removeToast();
    });

    toast.appendChild(content);
    toast.appendChild(closeButton);

    document.body.appendChild(toast);

    this.toastElement = toast;

    requestAnimationFrame(() => {
      toast.classList.add("visible");
    });

    this.hideTimeout = setTimeout(() => {
      this.removeToast();
    }, toastDuration);
  }

  private removeToast(): void {
    if (this.hideTimeout !== null) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    if (this.toastElement === null) {
      return;
    }

    const toast = this.toastElement;

    toast.classList.remove("visible");

    setTimeout(() => {
      toast.remove();
    }, 200);

    this.toastElement = null;
  }
}
