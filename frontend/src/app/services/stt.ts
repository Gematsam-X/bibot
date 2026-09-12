import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
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

    this.mediaRecorder.addEventListener('dataavailable', event => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    });

    this.mediaRecorder.start();

    this.isRecording.set(true);
  }

  async stopRecording(): Promise<string> {
    if (!this.mediaRecorder || !this.isRecording()) {
      return '';
    }

    const recorder = this.mediaRecorder;

    const audioBlob = await new Promise<Blob>(resolve => {
      recorder.addEventListener(
        'stop',
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

    this.stream?.getTracks().forEach(track => track.stop());

    this.stream = undefined;
    this.mediaRecorder = undefined;

    return this.transcribe(audioBlob);
  }

  private async transcribe(audio: Blob): Promise<string> {
    this.isTranscribing.set(true);

    try {
      const formData = new FormData();

      formData.append(
        'audio',
        audio,
        'recording.webm',
      );

      const response = await firstValueFrom(
        this.http.post<{ text: string }>(
          '/api/stt',
          formData,
        ),
      );

      return response.text;
    } finally {
      this.isTranscribing.set(false);
    }
  }
}