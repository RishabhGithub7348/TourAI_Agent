"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var VoiceGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const common_1 = require("@nestjs/common");
const common_2 = require("@nestjs/common");
const socket_io_1 = require("socket.io");
const uuid_1 = require("uuid");
const gemini_service_1 = require("../services/gemini.service");
const memory_service_1 = require("../services/memory.service");
const audio_utils_1 = require("../utils/audio.utils");
const ws_exception_filter_1 = require("../filters/ws-exception.filter");
let VoiceGateway = VoiceGateway_1 = class VoiceGateway {
    constructor(geminiService, memoryService) {
        this.geminiService = geminiService;
        this.memoryService = memoryService;
        this.logger = new common_2.Logger(VoiceGateway_1.name);
        this.sessions = new Map();
    }
    async handleConnection(client) {
        this.logger.log(`Client connected: ${client.id}`);
        const sessionId = (0, uuid_1.v4)();
        const userId = this.memoryService.getUserId(sessionId);
        const sessionData = {
            sessionId,
            userId,
            geminiSession: null,
            currentConversation: [],
            hasUserAudio: false,
            userAudioBuffer: Buffer.alloc(0),
            hasAssistantAudio: false,
            assistantAudioBuffer: Buffer.alloc(0),
            shouldAccumulateUserAudio: true,
            audioResponseQueue: [],
            isProcessingAudioResponse: false,
        };
        this.sessions.set(client.id, sessionData);
        client.emit('connected', { sessionId, userId });
    }
    handleDisconnect(client) {
        this.logger.log(`Client disconnected: ${client.id}`);
        const sessionData = this.sessions.get(client.id);
        if (sessionData?.geminiSession) {
            try {
                sessionData.geminiSession.close?.();
            }
            catch (error) {
                this.logger.error(`Error closing Gemini session: ${error.message}`);
            }
        }
        this.sessions.delete(client.id);
    }
    async handleSetup(client, data) {
        try {
            const sessionData = this.sessions.get(client.id);
            if (!sessionData) {
                client.emit('error', { message: 'Session not found' });
                return;
            }
            const config = data.setup || {};
            if (config.location) {
                sessionData.location = config.location;
                this.logger.log(`User location set for client ${client.id}: ${config.location}`);
            }
            const enhancedConfig = {
                responseModalities: ['AUDIO'],
                systemInstruction: "You are a helpful tour guide assistant. Answer in a friendly and informative tone."
            };
            const messageHandler = (data) => {
                try {
                    this.handleGeminiMessage(client, sessionData, data);
                }
                catch (error) {
                    this.logger.error(`Error in message handler: ${error.message}`);
                    client.emit('error', { message: 'Failed to process response' });
                }
            };
            sessionData.geminiSession = await this.geminiService.createLiveSession(enhancedConfig, messageHandler);
            this.logger.log(`Gemini session created for client: ${client.id}${config.location ? ` with location: ${config.location}` : ''}`);
            client.emit('setup_complete', { status: 'ready', location: config.location });
            this.startGeminiHandlers(client, sessionData);
        }
        catch (error) {
            this.logger.error(`Setup error: ${error.message}`);
            client.emit('error', { message: 'Setup failed' });
        }
    }
    async handleRealtimeInput(client, data) {
        const sessionData = this.sessions.get(client.id);
        if (!sessionData?.geminiSession) {
            return;
        }
        try {
            if (data.realtime_input) {
                for (const chunk of data.realtime_input.media_chunks) {
                    if (chunk.mime_type === 'audio/pcm' || chunk.mime_type === 'audio/webm') {
                        if (sessionData.geminiSession && sessionData.geminiSession.sendRealtimeInput) {
                            try {
                                sessionData.geminiSession.sendRealtimeInput({
                                    audio: {
                                        data: chunk.data,
                                        mimeType: chunk.mime_type === 'audio/pcm' ? 'audio/pcm;rate=16000' : chunk.mime_type
                                    }
                                });
                                this.logger.log(`Sent audio chunk to Gemini: ${chunk.mime_type}, size: ${chunk.data.length}`);
                            }
                            catch (error) {
                                this.logger.error(`Error sending audio to Gemini: ${error.message}`);
                            }
                        }
                        if (sessionData.shouldAccumulateUserAudio) {
                            try {
                                const audioChunk = audio_utils_1.AudioUtils.base64ToBuffer(chunk.data);
                                sessionData.hasUserAudio = true;
                                sessionData.userAudioBuffer = Buffer.concat([
                                    sessionData.userAudioBuffer,
                                    audioChunk,
                                ]);
                            }
                            catch (error) {
                                this.logger.error(`Error processing audio chunk: ${error.message}`);
                            }
                        }
                    }
                    else if (chunk.mime_type.startsWith('image/')) {
                        sessionData.currentConversation.push({
                            role: 'user',
                            content: '[Image shared by user]',
                        });
                        if (sessionData.geminiSession && sessionData.geminiSession.sendRealtimeInput) {
                            try {
                                sessionData.geminiSession.sendRealtimeInput({
                                    media: {
                                        data: chunk.data,
                                        mimeType: chunk.mime_type
                                    }
                                });
                            }
                            catch (error) {
                                this.logger.error(`Error sending image to Gemini: ${error.message}`);
                            }
                        }
                    }
                }
            }
        }
        catch (error) {
            this.logger.error(`Error handling realtime input: ${error.message}`);
        }
    }
    async handleTextInput(client, data) {
        const sessionData = this.sessions.get(client.id);
        if (!sessionData?.geminiSession) {
            client.emit('error', { message: 'No active session' });
            return;
        }
        try {
            const textContent = data.text;
            sessionData.currentConversation.push({
                role: 'user',
                content: textContent,
            });
            if (sessionData.geminiSession && sessionData.geminiSession.sendClientContent) {
                try {
                    sessionData.geminiSession.sendClientContent({
                        turns: {
                            role: 'user',
                            parts: [{ text: textContent }]
                        },
                        turnComplete: true
                    });
                    this.logger.log(`Sent text to Gemini: ${textContent}`);
                }
                catch (error) {
                    this.logger.error(`Error sending text to Gemini: ${error.message}`);
                    client.emit('error', { message: 'Failed to process message' });
                }
            }
            else {
                client.emit('error', { message: 'No active Gemini session' });
            }
        }
        catch (error) {
            this.logger.error(`Error handling text input: ${error.message}`);
            client.emit('error', { message: 'Failed to process message' });
        }
    }
    handleGeminiMessage(client, sessionData, message) {
        try {
            this.logger.log('Received message from Gemini:', JSON.stringify(message, null, 2));
            if (message.data) {
                sessionData.audioResponseQueue.push(message);
                if (!sessionData.isProcessingAudioResponse) {
                    this.processAudioQueue(client, sessionData);
                }
                return;
            }
            if (message.serverContent) {
                const { modelTurn, turnComplete } = message.serverContent;
                if (modelTurn && modelTurn.parts) {
                    for (const part of modelTurn.parts) {
                        if (part.text) {
                            client.emit('text', { text: part.text });
                            sessionData.currentConversation.push({
                                role: 'assistant',
                                content: part.text,
                            });
                        }
                        if (part.inlineData && part.inlineData.mimeType?.startsWith('audio/')) {
                            this.logger.log('Received inline audio data');
                            client.emit('audio', { audio: part.inlineData.data });
                        }
                    }
                }
                if (turnComplete) {
                    this.handleTurnComplete(client, sessionData);
                }
            }
            if (message.toolCall) {
                this.handleGeminiFunctionCall(client, sessionData, message.toolCall);
            }
            if (message.setupComplete) {
                this.logger.log('Gemini Live session setup completed');
            }
        }
        catch (error) {
            this.logger.error(`Error handling Gemini message: ${error.message}`);
        }
    }
    async processAudioQueue(client, sessionData) {
        if (sessionData.isProcessingAudioResponse || sessionData.audioResponseQueue.length === 0) {
            return;
        }
        sessionData.isProcessingAudioResponse = true;
        try {
            await this.waitForAudioTurnComplete(sessionData);
            const combinedAudio = this.combineAudioChunks(sessionData.audioResponseQueue);
            if (combinedAudio) {
                this.logger.log(`Sending combined audio response, length: ${combinedAudio.length}`);
                client.emit('audio', { audio: combinedAudio });
            }
            sessionData.audioResponseQueue = [];
        }
        catch (error) {
            this.logger.error(`Error processing audio queue: ${error.message}`);
        }
        finally {
            sessionData.isProcessingAudioResponse = false;
        }
    }
    async waitForAudioTurnComplete(sessionData, timeoutMs = 2000) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            const checkComplete = () => {
                if (Date.now() - startTime > timeoutMs) {
                    resolve();
                    return;
                }
                setTimeout(checkComplete, 100);
            };
            checkComplete();
        });
    }
    combineAudioChunks(audioQueue) {
        try {
            const audioBuffers = [];
            for (const message of audioQueue) {
                if (message.data) {
                    const buffer = Buffer.from(message.data, 'base64');
                    audioBuffers.push(buffer);
                }
            }
            if (audioBuffers.length === 0) {
                return null;
            }
            const combinedBuffer = Buffer.concat(audioBuffers);
            const wavBase64 = audio_utils_1.AudioUtils.convertBase64PcmToWav(combinedBuffer.toString('base64'), 24000);
            return wavBase64;
        }
        catch (error) {
            this.logger.error(`Error combining audio chunks: ${error.message}`);
            return null;
        }
    }
    async handleGeminiFunctionCall(client, sessionData, toolCall) {
        try {
            const result = await this.geminiService.handleFunctionCall(toolCall, sessionData.userId);
            if (result && sessionData.geminiSession && sessionData.geminiSession.sendToolResponse) {
                sessionData.geminiSession.sendToolResponse({
                    functionResponses: [result]
                });
            }
        }
        catch (error) {
            this.logger.error(`Error handling function call: ${error.message}`);
        }
    }
    async startGeminiHandlers(client, sessionData) {
        try {
            if (!sessionData.geminiSession) {
                this.logger.error('No Gemini session available');
                return;
            }
            this.logger.log('Gemini handlers started for client:', client.id);
            const welcomeMessage = sessionData.location
                ? `Hello! I'm your AI tour guide. I see you're currently in ${sessionData.location}. How can I help you explore this area today?`
                : `Hello! I'm your AI tour guide. How can I help you explore today? Feel free to share your location for personalized recommendations.`;
            client.emit('text', { text: welcomeMessage });
        }
        catch (error) {
            this.logger.error(`Fatal error in Gemini handlers: ${error.message}`);
            client.emit('error', { message: 'Failed to start AI session' });
        }
    }
    async handleTurnComplete(client, sessionData) {
        let userText = null;
        let assistantText = null;
        if (sessionData.hasUserAudio && sessionData.userAudioBuffer.length > 0) {
            try {
                const userWavBase64 = audio_utils_1.AudioUtils.convertPcmToWav(sessionData.userAudioBuffer, true);
                if (userWavBase64) {
                    userText = await this.geminiService.transcribeAudio(userWavBase64);
                    this.logger.log(`Transcribed user audio: ${userText}`);
                }
                else {
                    userText = 'User audio could not be processed.';
                }
            }
            catch (error) {
                this.logger.error(`Error processing user audio: ${error.message}`);
                userText = 'User audio processing error.';
            }
        }
        if (sessionData.hasAssistantAudio && sessionData.assistantAudioBuffer.length > 0) {
            try {
                const assistantWavBase64 = audio_utils_1.AudioUtils.convertPcmToWav(sessionData.assistantAudioBuffer, false);
                if (assistantWavBase64) {
                    assistantText = await this.geminiService.transcribeAudio(assistantWavBase64);
                    if (assistantText) {
                        client.emit('text', { text: assistantText });
                    }
                }
                else {
                    assistantText = 'Assistant audio could not be processed.';
                }
            }
            catch (error) {
                this.logger.error(`Error processing assistant audio: ${error.message}`);
                assistantText = 'Assistant audio processing error.';
            }
        }
        if (userText && assistantText) {
            const messages = [
                { role: 'user', content: userText },
                { role: 'assistant', content: assistantText },
            ];
            await this.memoryService.addToMemory(messages, sessionData.userId);
            this.logger.log('Turn complete, memory updated');
        }
        else {
            this.logger.log('Skipping memory update: Missing user or assistant text');
        }
        sessionData.hasUserAudio = false;
        sessionData.userAudioBuffer = Buffer.alloc(0);
        sessionData.hasAssistantAudio = false;
        sessionData.assistantAudioBuffer = Buffer.alloc(0);
        sessionData.shouldAccumulateUserAudio = true;
        sessionData.audioResponseQueue = [];
        sessionData.isProcessingAudioResponse = false;
        this.logger.log('Re-enabling user audio accumulation for next turn');
    }
};
exports.VoiceGateway = VoiceGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], VoiceGateway.prototype, "server", void 0);
__decorate([
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], VoiceGateway.prototype, "handleConnection", null);
__decorate([
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], VoiceGateway.prototype, "handleDisconnect", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('setup'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], VoiceGateway.prototype, "handleSetup", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('realtime_input'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], VoiceGateway.prototype, "handleRealtimeInput", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('text'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], VoiceGateway.prototype, "handleTextInput", null);
exports.VoiceGateway = VoiceGateway = VoiceGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)(9084, {
        cors: {
            origin: '*',
        },
        compression: false,
    }),
    (0, common_1.UseFilters)(ws_exception_filter_1.WsExceptionFilter),
    __metadata("design:paramtypes", [gemini_service_1.GeminiService,
        memory_service_1.MemoryService])
], VoiceGateway);
//# sourceMappingURL=voice.gateway.js.map