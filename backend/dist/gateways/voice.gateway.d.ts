import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GeminiService } from '../services/gemini.service';
import { MemoryService } from '../services/memory.service';
import { WebSocketMessage } from '../interfaces/conversation.interface';
export declare class VoiceGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private geminiService;
    private memoryService;
    server: Server;
    private readonly logger;
    private sessions;
    private readonly MAX_CONCURRENT_CONNECTIONS;
    private activeGeminiSessions;
    private logSessionStatus;
    constructor(geminiService: GeminiService, memoryService: MemoryService);
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): void;
    handleSetup(client: Socket, data: any): Promise<void>;
    handleStartInteraction(client: Socket, data: any): Promise<void>;
    handleStopInteraction(client: Socket, data: any): Promise<void>;
    handleGetSessionStatus(client: Socket, data: any): Promise<void>;
    handleRealtimeInput(client: Socket, data: WebSocketMessage): Promise<void>;
    handleTextInput(client: Socket, data: {
        text: string;
    }): Promise<void>;
    private handleGeminiMessage;
    private handleInterruption;
    private processAudioQueue;
    private waitForAudioTurnComplete;
    private combineAudioChunks;
    private handleGeminiFunctionCall;
    private startGeminiHandlers;
    private handleTurnComplete;
    private createSessionOnDemand;
}
