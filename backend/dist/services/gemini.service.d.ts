import { AppConfigService } from '../config/config.service';
import { MemoryService } from './memory.service';
import { ToolsService } from './tools.service';
export declare class GeminiService {
    private configService;
    private memoryService;
    private toolsService;
    private readonly logger;
    private client;
    private readonly MODEL;
    constructor(configService: AppConfigService, memoryService: MemoryService, toolsService: ToolsService);
    private getDefaultTools;
    private getVoiceForLanguage;
    private getLanguageName;
    createLiveSession(config?: any, messageHandler?: (data: any) => void): Promise<{
        originalSession: import("@google/genai").Session;
        responseQueue: any[];
        waitMessage: () => Promise<any>;
        handleTurn: () => Promise<any[]>;
        sendClientContent: (data: any) => void;
        sendRealtimeInput: (data: any) => void;
        sendAudioStreamEnd: () => void;
        sendToolResponse: (data: any) => void;
        close: () => void;
    }>;
    createLiveSessionWithTools(tools: any[], additionalConfig?: any, messageHandler?: (data: any) => void): Promise<{
        originalSession: import("@google/genai").Session;
        responseQueue: any[];
        waitMessage: () => Promise<any>;
        handleTurn: () => Promise<any[]>;
        sendClientContent: (data: any) => void;
        sendRealtimeInput: (data: any) => void;
        sendAudioStreamEnd: () => void;
        sendToolResponse: (data: any) => void;
        close: () => void;
    }>;
    handleFunctionCall(functionCall: any, userId: string): Promise<any>;
    transcribeAudio(audioData: string): Promise<string>;
}
