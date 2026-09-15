import { HttpClient } from "@angular/common/http";
import { Injectable, inject, signal } from "@angular/core";
import { firstValueFrom } from "rxjs";

@Injectable({
  providedIn: "root",
})
export class SttService {
  private readonly http = inject(HttpClient);

  readonly isRecording = signal(false);
  readonly isTranscribing = signal(false);

  private mediaRecorder?: MediaRecorder;
  private audioChunks: Blob[] = [];
  private stream?: MediaStream;

  async startRecording(): Promise<void> {
    if (this.isRecording() || this.isTranscribing()) {
      return;
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    this.audioChunks = [];

    this.mediaRecorder = new MediaRecorder(this.stream);

    this.mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    });

    this.mediaRecorder.start();

    this.isRecording.set(true);
  }

  async stopRecording(): Promise<string> {
    if (!this.mediaRecorder || !this.isRecording()) {
      return "";
    }

    const recorder = this.mediaRecorder;

    const audioBlob = await new Promise<Blob>((resolve) => {
      recorder.addEventListener(
        "stop",
        () => {
          resolve(
            new Blob(this.audioChunks, {
              type: recorder.mimeType,
            }),
          );
        },
        { once: true },
      );

      recorder.stop();
    });

    this.isRecording.set(false);

    this.stream?.getTracks().forEach((track) => track.stop());

    this.stream = undefined;
    this.mediaRecorder = undefined;
    this.audioChunks = [];

    return this.transcribe(audioBlob);
  }

  async cancelRecording(): Promise<void> {
    if (!this.mediaRecorder || !this.isRecording()) {
      return;
    }

    const recorder = this.mediaRecorder;

    // Stop the recorder without processing or transcribing the audio.
    if (recorder.state !== "inactive") {
      recorder.stop();
    }

    // Immediately discard all recorded audio.
    this.audioChunks = [];

    // Release the microphone.
    this.stream?.getTracks().forEach((track) => track.stop());

    // Reset the recording state.
    this.stream = undefined;
    this.mediaRecorder = undefined;
    this.isRecording.set(false);
  }

  private async transcribe(audio: Blob): Promise<string> {
    this.isTranscribing.set(true);

    try {
      const formData = new FormData();

      formData.append(
        "audio",
        audio,
        "recording.webm",
      );

      const response = await firstValueFrom(
        this.http.post<{ text: string }>(
          "/api/stt",
          formData,
        ),
      );

      return response.text;
    } finally {
      this.isTranscribing.set(false);
    }
  }
}