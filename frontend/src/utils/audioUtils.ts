// Audio utility functions for Gemini Live API compatibility

export class AudioUtils {
  /**
   * Convert audio blob to 16-bit PCM at 16kHz for Gemini Live API
   */
  static async convertToPCM(audioBlob: Blob): Promise<string> {
    try {
      console.log('Starting PCM conversion for blob:', audioBlob.size, 'bytes');
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const arrayBuffer = await audioBlob.arrayBuffer();
      console.log('ArrayBuffer size:', arrayBuffer.byteLength);
      
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      console.log('Decoded audio:', {
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels,
        length: audioBuffer.length
      });
      
      // Resample to 16kHz if needed
      const targetSampleRate = 16000;
      const offlineContext = new OfflineAudioContext(
        1, // mono
        Math.floor(audioBuffer.duration * targetSampleRate),
        targetSampleRate
      );
      
      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineContext.destination);
      source.start();
      
      const resampled = await offlineContext.startRendering();
      console.log('Resampled to 16kHz:', {
        duration: resampled.duration,
        sampleRate: resampled.sampleRate,
        length: resampled.length
      });
      
      // Convert to mono if stereo
      const channelData = resampled.numberOfChannels > 1 
        ? this.convertToMono(resampled)
        : resampled.getChannelData(0);
      
      console.log('Channel data length:', channelData.length);
      
      // Convert float32 to int16 PCM
      const pcmData = this.float32ToInt16(channelData);
      console.log('PCM data length:', pcmData.length);
      
      // Convert to base64
      const base64 = this.arrayBufferToBase64(pcmData.buffer);
      console.log('Base64 length:', base64.length);
      
      return base64;
    } catch (error) {
      console.error('Error converting audio to PCM:', error);
      throw error;
    }
  }

  /**
   * Convert base64 PCM to ArrayBuffer for playback
   */
  static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Convert stereo to mono by averaging channels
   */
  private static convertToMono(audioBuffer: AudioBuffer): Float32Array {
    const leftChannel = audioBuffer.getChannelData(0);
    const rightChannel = audioBuffer.getChannelData(1);
    const monoData = new Float32Array(leftChannel.length);
    
    for (let i = 0; i < leftChannel.length; i++) {
      monoData[i] = (leftChannel[i] + rightChannel[i]) / 2;
    }
    
    return monoData;
  }

  /**
   * Convert Float32Array to Int16Array (PCM format)
   */
  private static float32ToInt16(float32Array: Float32Array): Int16Array {
    const int16Array = new Int16Array(float32Array.length);
    
    for (let i = 0; i < float32Array.length; i++) {
      // Clamp values to [-1, 1] and convert to 16-bit integer
      const clampedValue = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = clampedValue * 0x7FFF;
    }
    
    return int16Array;
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private static arrayBufferToBase64(buffer: ArrayBufferLike): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Create audio context with optimal settings for voice recording
   */
  static createAudioContext(): AudioContext {
    return new AudioContext({
      sampleRate: 24000,
      latencyHint: 'interactive',
    });
  }

  /**
   * Get media constraints optimized for Gemini Live API
   */
  static getMediaConstraints(): MediaStreamConstraints {
    return {
      audio: {
        sampleRate: 16000, // Gemini Live API expects 16kHz
        channelCount: 1,   // Mono
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleSize: 16,    // 16-bit
      } as MediaTrackConstraints,
    };
  }

  /**
   * Play base64 encoded PCM audio from Gemini Live API (24kHz output)
   */
  static async playBase64Audio(base64Audio: string): Promise<void> {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Convert base64 to ArrayBuffer
      const arrayBuffer = this.base64ToArrayBuffer(base64Audio);
      const int16Array = new Int16Array(arrayBuffer);
      
      // Convert int16 PCM to float32
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 0x7FFF;
      }
      
      // Create audio buffer (Gemini outputs at 24kHz)
      const audioBuffer = audioContext.createBuffer(1, float32Array.length, 24000);
      audioBuffer.copyToChannel(float32Array, 0);
      
      // Play the audio
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start();
    } catch (error) {
      console.error('Error playing audio:', error);
      throw error;
    }
  }
}