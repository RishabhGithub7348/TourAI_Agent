export declare class AudioUtils {
    static convertPcmToWav(pcmData: Buffer, isUserInput?: boolean): string | null;
    static processGeminiAudioChunks(chunks: any[]): Buffer;
    static convertBase64PcmToWav(base64Data: string, sampleRate?: number): string;
    static base64ToBuffer(base64String: string): Buffer;
    static bufferToBase64(buffer: Buffer): string;
}
