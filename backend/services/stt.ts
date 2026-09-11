import { spawn } from 'node:child_process';
import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const STT_DIR = path.resolve('./stt');
const TEMP_DIR = path.join(STT_DIR, 'temp');

const FFMPEG = 'ffmpeg';
const WHISPER = path.join(STT_DIR, 'whisper-cli');
const MODEL = path.join(STT_DIR, 'models', 'ggml-small.bin');

export async function transcribeAudio(inputFile: string): Promise<string> {
  await mkdir(TEMP_DIR, { recursive: true });

  const id = randomUUID();

  const wavFile = path.join(TEMP_DIR, `${id}.wav`);

  try {
    await runProcess(FFMPEG, [
      '-y',
      '-i',
      inputFile,
      '-ar',
      '16000',
      '-ac',
      '1',
      wavFile,
    ]);

    const text = await runProcess(WHISPER, [
      '-m',
      MODEL,
      '-f',
      wavFile,
      '-l',
      'it',
      '--no-timestamps',
    ]);

    return text.trim();
  } finally {
    await unlink(inputFile).catch(() => {});
    await unlink(wavFile).catch(() => {});
  }
}

function runProcess(
  command: string,
  args: string[],
): Promise<string> {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args);

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('error', reject);

    process.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(
        new Error(
          `${command} exited with code ${code}: ${stderr}`,
        ),
      );
    });
  });
}