"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioUtils = void 0;
const wavefile_1 = require("wavefile");
class AudioUtils {
    static convertPcmToWav(pcmData, isUserInput = false) {
        try {
            if (!Buffer.isBuffer(pcmData)) {
                console.log(`PCM data is not a Buffer, it's ${typeof pcmData}`);
                return null;
            }
            const sampleRate = isUserInput ? 16000 : 24000;
            const int16Array = new Int16Array(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength / 2);
            const wav = new wavefile_1.WaveFile();
            wav.fromScratch(1, sampleRate, '16', int16Array);
            return wav.toBase64();
        }
        catch (error) {
            console.error(`Error converting PCM to WAV: ${error.message}`);
            return null;
        }
    }
    static processGeminiAudioChunks(chunks) {
        const audioBuffers = [];
        for (const chunk of chunks) {
            if (chunk.data) {
                const buffer = Buffer.from(chunk.data, 'base64');
                audioBuffers.push(buffer);
            }
        }
        return Buffer.concat(audioBuffers);
    }
    static convertBase64PcmToWav(base64Data, sampleRate = 24000) {
        try {
            const buffer = Buffer.from(base64Data, 'base64');
            const int16Array = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 2);
            const wav = new wavefile_1.WaveFile();
            wav.fromScratch(1, sampleRate, '16', int16Array);
            return wav.toBase64();
        }
        catch (error) {
            console.error(`Error converting base64 PCM to WAV: ${error.message}`);
            throw error;
        }
    }
    static base64ToBuffer(base64String) {
        try {
            return Buffer.from(base64String, 'base64');
        }
        catch (error) {
            console.error(`Error converting base64 to buffer: ${error.message}`);
            return Buffer.alloc(0);
        }
    }
    static bufferToBase64(buffer) {
        try {
            return buffer.toString('base64');
        }
        catch (error) {
            console.error(`Error converting buffer to base64: ${error.message}`);
            return '';
        }
    }
}
exports.AudioUtils = AudioUtils;
//# sourceMappingURL=audio.utils.js.map