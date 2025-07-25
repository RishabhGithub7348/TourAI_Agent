import { WaveFile } from 'wavefile';

export class AudioUtils {
  static convertPcmToWav(pcmData: Buffer, isUserInput: boolean = false): string | null {
    try {
      if (!Buffer.isBuffer(pcmData)) {
        console.log(`PCM data is not a Buffer, it's ${typeof pcmData}`);
        return null;
      }

      const sampleRate = isUserInput ? 16000 : 24000;
      
      // Convert buffer to Int16Array for wavefile
      const int16Array = new Int16Array(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength / 2);
      
      // Create WAV file using wavefile library
      const wav = new WaveFile();
      wav.fromScratch(1, sampleRate, '16', int16Array);
      
      return wav.toBase64();
    } catch (error) {
      console.error(`Error converting PCM to WAV: ${error.message}`);
      return null;
    }
  }

  /**
   * Process audio chunks from Gemini Live API
   */
  static processGeminiAudioChunks(chunks: any[]): Buffer {
    const audioBuffers: Buffer[] = [];
    
    for (const chunk of chunks) {
      if (chunk.data) {
        const buffer = Buffer.from(chunk.data, 'base64');
        audioBuffers.push(buffer);
      }
    }
    
    return Buffer.concat(audioBuffers);
  }

  /**
   * Convert base64 PCM audio to WAV for playback
   */
  static convertBase64PcmToWav(base64Data: string, sampleRate: number = 24000): string {
    try {
      const buffer = Buffer.from(base64Data, 'base64');
      const int16Array = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 2);
      
      const wav = new WaveFile();
      wav.fromScratch(1, sampleRate, '16', int16Array);
      
      return wav.toBase64();
    } catch (error) {
      console.error(`Error converting base64 PCM to WAV: ${error.message}`);
      throw error;
    }
  }

  static base64ToBuffer(base64String: string): Buffer {
    try {
      return Buffer.from(base64String, 'base64');
    } catch (error) {
      console.error(`Error converting base64 to buffer: ${error.message}`);
      return Buffer.alloc(0);
    }
  }

  static bufferToBase64(buffer: Buffer): string {
    try {
      return buffer.toString('base64');
    } catch (error) {
      console.error(`Error converting buffer to base64: ${error.message}`);
      return '';
    }
  }
}