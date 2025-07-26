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
    logSessionStatus() {
        const actualActiveSessions = Array.from(this.sessions.values()).filter(session => session.geminiSession !== null).length;
        if (actualActiveSessions !== this.activeGeminiSessions) {
            this.logger.warn(`⚠️ Session counter mismatch! Counter: ${this.activeGeminiSessions}, Actual: ${actualActiveSessions}`);
        }
        else {
            this.logger.debug(`✅ Session counter accurate: ${this.activeGeminiSessions}/${this.MAX_CONCURRENT_CONNECTIONS}`);
        }
    }
    constructor(geminiService, memoryService) {
        this.geminiService = geminiService;
        this.memoryService = memoryService;
        this.logger = new common_2.Logger(VoiceGateway_1.name);
        this.sessions = new Map();
        this.MAX_CONCURRENT_CONNECTIONS = 3;
        this.activeGeminiSessions = 0;
    }
    async handleConnection(client) {
        this.logger.log(`Client connected: ${client.id}`);
        const sessionId = (0, uuid_1.v4)();
        const sessionData = {
            sessionId,
            userId: 'pending',
            geminiSession: null,
            currentConversation: [],
            hasUserAudio: false,
            userAudioBuffer: Buffer.alloc(0),
            hasAssistantAudio: false,
            assistantAudioBuffer: Buffer.alloc(0),
            shouldAccumulateUserAudio: true,
            audioResponseQueue: [],
            isProcessingAudioResponse: false,
            isCreatingSession: false,
        };
        this.sessions.set(client.id, sessionData);
        client.emit('connected', {
            sessionId,
            userId: 'pending',
            status: 'ready_for_interaction'
        });
    }
    handleDisconnect(client) {
        this.logger.log(`🔌 Client disconnected: ${client.id}`);
        const sessionData = this.sessions.get(client.id);
        if (sessionData) {
            if (sessionData.geminiSession) {
                try {
                    sessionData.geminiSession.close?.();
                    this.activeGeminiSessions = Math.max(0, this.activeGeminiSessions - 1);
                    this.logger.log(`🛑 Gemini session closed due to disconnect. Active sessions: ${this.activeGeminiSessions}/${this.MAX_CONCURRENT_CONNECTIONS}`);
                }
                catch (error) {
                    this.logger.error(`Error closing Gemini session on disconnect: ${error.message}`);
                }
            }
            if (sessionData.isCreatingSession) {
                this.activeGeminiSessions = Math.max(0, this.activeGeminiSessions - 1);
                this.logger.log(`🧹 Cleaned up session creation in progress for disconnected client. Active sessions: ${this.activeGeminiSessions}/${this.MAX_CONCURRENT_CONNECTIONS}`);
            }
            if (sessionData.userAudioBuffer) {
                sessionData.userAudioBuffer = Buffer.alloc(0);
            }
            if (sessionData.assistantAudioBuffer) {
                sessionData.assistantAudioBuffer = Buffer.alloc(0);
            }
            sessionData.audioResponseQueue = [];
        }
        this.sessions.delete(client.id);
        this.logger.log(`🗑️ Session data cleaned up for client: ${client.id}`);
        this.logSessionStatus();
    }
    async handleSetup(client, data) {
        try {
            const sessionData = this.sessions.get(client.id);
            if (!sessionData) {
                client.emit('error', { message: 'Session not found' });
                return;
            }
            const config = data.setup || {};
            if (config.userId) {
                sessionData.userId = config.userId;
                this.logger.log(`✅ User ID set for client ${client.id}: ${config.userId}`);
                console.log(`📋 User ID received from frontend: ${config.userId}`);
            }
            else {
                sessionData.userId = this.memoryService.getUserId(sessionData.sessionId);
                this.logger.log(`⚠️ No user ID provided, using fallback: ${sessionData.userId}`);
                console.log(`⚠️ No user ID from frontend, using fallback: ${sessionData.userId}`);
            }
            if (config.location) {
                sessionData.location = config.location;
                this.logger.log(`User location set for client ${client.id}: ${config.location}`);
            }
            this.logger.log(`Setup completed for client: ${client.id}. Waiting for user interaction to create session.`);
            client.emit('setup_complete', {
                status: 'waiting_for_interaction',
                location: config.location,
                userId: sessionData.userId,
                message: 'Ready to start. Click the audio button to begin conversation.'
            });
        }
        catch (error) {
            this.logger.error(`Setup error: ${error.message}`);
            client.emit('error', { message: 'Setup failed' });
        }
    }
    async handleStartInteraction(client, data) {
        try {
            const sessionData = this.sessions.get(client.id);
            if (!sessionData) {
                client.emit('error', { message: 'Session not found' });
                return;
            }
            if (data.location) {
                const loc = data.location;
                const locationParts = [];
                if (loc.city)
                    locationParts.push(loc.city);
                if (loc.state)
                    locationParts.push(loc.state);
                if (loc.country)
                    locationParts.push(loc.country);
                sessionData.location = locationParts.join(', ') || 'Unknown location';
                this.logger.log(`🌍 Location received for client ${client.id}: ${sessionData.location}`);
            }
            const language = data.language || 'en-US';
            sessionData.language = language;
            this.logger.log(`🗣️ Language preference for client ${client.id}: ${language}`);
            if (sessionData.geminiSession) {
                client.emit('interaction_started', { status: 'already_active' });
                return;
            }
            if (sessionData.isCreatingSession) {
                client.emit('interaction_started', {
                    status: 'creation_in_progress',
                    message: 'Session is already being created, please wait.'
                });
                return;
            }
            if (this.activeGeminiSessions >= this.MAX_CONCURRENT_CONNECTIONS) {
                this.logger.warn(`Connection limit reached (${this.activeGeminiSessions}/${this.MAX_CONCURRENT_CONNECTIONS}). Rejecting client: ${client.id}`);
                client.emit('error', {
                    message: 'Server is at capacity. Please try again in a few moments.',
                    code: 'CONNECTION_LIMIT_REACHED'
                });
                return;
            }
            const enhancedConfig = {
                responseModalities: ['AUDIO'],
                locationContext: sessionData.location,
                language: language
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
            try {
                sessionData.isCreatingSession = true;
                this.activeGeminiSessions++;
                this.logger.log(`🚀 Creating Gemini session ${this.activeGeminiSessions}/${this.MAX_CONCURRENT_CONNECTIONS} for client: ${client.id} (USER INITIATED)`);
                sessionData.geminiSession = await this.geminiService.createLiveSession(enhancedConfig, messageHandler);
                this.logger.log(`✅ Gemini session created for client: ${client.id}${sessionData.location ? ` with location: ${sessionData.location}` : ''}`);
                client.emit('interaction_started', {
                    status: 'active',
                    sessionId: sessionData.sessionId,
                    message: 'AI session started. You can now speak or type.'
                });
                this.startGeminiHandlers(client, sessionData);
            }
            catch (error) {
                this.activeGeminiSessions--;
                this.logger.error(`Failed to create Gemini session: ${error.message}`);
                client.emit('error', { message: 'Failed to start AI session' });
            }
            finally {
                sessionData.isCreatingSession = false;
            }
        }
        catch (error) {
            this.logger.error(`Start interaction error: ${error.message}`);
            client.emit('error', { message: 'Failed to start interaction' });
        }
    }
    async handleStopInteraction(client, data) {
        try {
            const sessionData = this.sessions.get(client.id);
            if (!sessionData) {
                client.emit('error', { message: 'Session not found' });
                return;
            }
            if (sessionData.geminiSession) {
                try {
                    sessionData.geminiSession.close?.();
                    sessionData.geminiSession = null;
                    this.activeGeminiSessions = Math.max(0, this.activeGeminiSessions - 1);
                    this.logger.log(`🛑 User stopped interaction. Gemini session closed for client: ${client.id}. Active sessions: ${this.activeGeminiSessions}/${this.MAX_CONCURRENT_CONNECTIONS}`);
                    sessionData.audioResponseQueue = [];
                    sessionData.isProcessingAudioResponse = false;
                    sessionData.hasUserAudio = false;
                    sessionData.hasAssistantAudio = false;
                    sessionData.userAudioBuffer = Buffer.alloc(0);
                    sessionData.assistantAudioBuffer = Buffer.alloc(0);
                    sessionData.isCreatingSession = false;
                    client.emit('interaction_stopped', {
                        status: 'stopped',
                        message: 'AI session ended. Click the audio button to start a new session.'
                    });
                    this.logSessionStatus();
                }
                catch (error) {
                    this.logger.error(`Error closing Gemini session: ${error.message}`);
                    client.emit('error', { message: 'Error stopping session' });
                }
            }
            else {
                client.emit('interaction_stopped', {
                    status: 'not_active',
                    message: 'No active session to stop.'
                });
            }
        }
        catch (error) {
            this.logger.error(`Stop interaction error: ${error.message}`);
            client.emit('error', { message: 'Failed to stop interaction' });
        }
    }
    async handleGetSessionStatus(client, data) {
        const totalSessions = this.sessions.size;
        const activeSessions = Array.from(this.sessions.values()).filter(session => session.geminiSession !== null).length;
        const creatingSessions = Array.from(this.sessions.values()).filter(session => session.isCreatingSession).length;
        const status = {
            totalConnectedClients: totalSessions,
            activeGeminiSessions: activeSessions,
            sessionCreationInProgress: creatingSessions,
            counterValue: this.activeGeminiSessions,
            maxAllowed: this.MAX_CONCURRENT_CONNECTIONS,
            counterAccurate: activeSessions === this.activeGeminiSessions
        };
        this.logger.log(`📊 Session Status: ${JSON.stringify(status)}`);
        client.emit('session_status', status);
    }
    async handleRealtimeInput(client, data) {
        const sessionData = this.sessions.get(client.id);
        if (!sessionData) {
            client.emit('error', { message: 'Session not found' });
            return;
        }
        if (!sessionData.geminiSession && !sessionData.isCreatingSession) {
            await this.createSessionOnDemand(client, sessionData);
            if (!sessionData.geminiSession) {
                return;
            }
        }
        else if (sessionData.isCreatingSession) {
            this.logger.debug(`Session creation in progress for client: ${client.id}, dropping request`);
            return;
        }
        try {
            if (data.audio) {
                if (sessionData.geminiSession && sessionData.geminiSession.sendRealtimeInput) {
                    try {
                        if (typeof data.audio === 'object' && 'data' in data.audio) {
                            const audioData = data.audio;
                            sessionData.geminiSession.sendRealtimeInput({
                                audio: {
                                    data: audioData.data,
                                    mimeType: audioData.mimeType || 'audio/pcm;rate=16000'
                                }
                            });
                            this.logger.debug(`Sent audio to Gemini: ${audioData.mimeType || 'audio/pcm;rate=16000'}`);
                        }
                        else {
                            sessionData.geminiSession.sendRealtimeInput({
                                audio: {
                                    data: data.audio,
                                    mimeType: 'audio/pcm;rate=16000'
                                }
                            });
                            this.logger.debug(`Sent audio to Gemini: audio/pcm;rate=16000`);
                        }
                    }
                    catch (error) {
                        this.logger.error(`Error sending audio to Gemini: ${error.message}`);
                    }
                }
                return;
            }
            if (data.audioStreamEnd) {
                if (sessionData.geminiSession && sessionData.geminiSession.sendAudioStreamEnd) {
                    try {
                        sessionData.geminiSession.sendAudioStreamEnd();
                        this.logger.debug('Sent audio stream end signal to Gemini');
                    }
                    catch (error) {
                        this.logger.error(`Error sending audio stream end: ${error.message}`);
                    }
                }
                return;
            }
            if (data.media) {
                if (sessionData.geminiSession && sessionData.geminiSession.sendRealtimeInput) {
                    try {
                        const mediaData = data.media;
                        sessionData.geminiSession.sendRealtimeInput({
                            audio: {
                                data: mediaData.data,
                                mimeType: mediaData.mimeType || 'audio/pcm;rate=16000'
                            }
                        });
                        this.logger.debug(`Sent media to Gemini: ${mediaData.mimeType || 'audio/pcm;rate=16000'}`);
                    }
                    catch (error) {
                        this.logger.error(`Error sending media to Gemini: ${error.message}`);
                    }
                }
                return;
            }
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
                                this.logger.debug(`Sent audio chunk to Gemini: ${chunk.mime_type}`);
                            }
                            catch (error) {
                                this.logger.error(`Error sending audio to Gemini: ${error.message}`);
                            }
                        }
                    }
                    else if (chunk.mime_type.startsWith('image/')) {
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
        if (!sessionData) {
            client.emit('error', { message: 'Session not found' });
            return;
        }
        if (!sessionData.geminiSession && !sessionData.isCreatingSession) {
            await this.createSessionOnDemand(client, sessionData);
            if (!sessionData.geminiSession) {
                return;
            }
        }
        else if (sessionData.isCreatingSession) {
            this.logger.debug(`Session creation in progress for client: ${client.id}, dropping request`);
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
                        turns: [{
                                role: 'user',
                                parts: [{ text: textContent }]
                            }],
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
            if (message.serverContent && message.serverContent.interrupted) {
                this.logger.log(`Generation was interrupted at ${new Date().toISOString()}`);
                this.handleInterruption(client, sessionData);
                client.emit('interrupted', {
                    timestamp: new Date().toISOString(),
                    message: 'Response interrupted by user input'
                });
                sessionData.audioResponseQueue = [];
                sessionData.isProcessingAudioResponse = false;
                return;
            }
            if (message.data) {
                sessionData.audioResponseQueue.push(message);
                if (!sessionData.isProcessingAudioResponse) {
                    this.processAudioQueue(client, sessionData);
                }
                return;
            }
            if (message.serverContent) {
                const { modelTurn, turnComplete, inputTranscription, outputTranscription } = message.serverContent;
                if (inputTranscription) {
                    client.emit('transcription', {
                        text: inputTranscription.text,
                        sender: 'user',
                        finished: inputTranscription.finished || false
                    });
                }
                if (outputTranscription) {
                    client.emit('transcription', {
                        text: outputTranscription.text,
                        sender: 'assistant',
                        finished: outputTranscription.finished || false
                    });
                }
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
    handleInterruption(client, sessionData) {
        try {
            sessionData.isProcessingAudioResponse = false;
            sessionData.audioResponseQueue = [];
            sessionData.assistantAudioBuffer = Buffer.alloc(0);
            sessionData.hasAssistantAudio = false;
            this.logger.log('Handled interruption - cleared audio state');
        }
        catch (error) {
            this.logger.error(`Error handling interruption: ${error.message}`);
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
            this.logger.log(`Received tool call: ${JSON.stringify(toolCall, null, 2)}`);
            const result = await this.geminiService.handleFunctionCall(toolCall, sessionData.userId);
            if (result && sessionData.geminiSession && sessionData.geminiSession.sendToolResponse) {
                this.logger.log(`Sending tool response: ${JSON.stringify(result, null, 2)}`);
                sessionData.geminiSession.sendToolResponse({
                    functionResponses: [result]
                });
            }
            else {
                this.logger.log('No custom tool response needed - Google Search/Code Execution handled automatically');
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
            this.logger.log('Session ready for user input');
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
            this.memoryService.addToMemoryAsync(messages, sessionData.userId);
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
    async createSessionOnDemand(client, sessionData) {
        sessionData.isCreatingSession = true;
        try {
            if (sessionData.geminiSession) {
                this.logger.debug(`Session already exists for client: ${client.id}, aborting creation`);
                return;
            }
            if (this.activeGeminiSessions >= this.MAX_CONCURRENT_CONNECTIONS) {
                this.logger.warn(`Connection limit reached (${this.activeGeminiSessions}/${this.MAX_CONCURRENT_CONNECTIONS}). Rejecting client: ${client.id}`);
                client.emit('error', {
                    message: 'Server is at capacity. Please try again in a few moments.',
                    code: 'CONNECTION_LIMIT_REACHED'
                });
                return;
            }
            const enhancedConfig = {
                responseModalities: ['AUDIO'],
                locationContext: sessionData.location,
                language: sessionData.language || 'en-US'
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
            this.activeGeminiSessions++;
            this.logger.log(`🚀 Creating Gemini session on-demand ${this.activeGeminiSessions}/${this.MAX_CONCURRENT_CONNECTIONS} for client: ${client.id}`);
            sessionData.geminiSession = await this.geminiService.createLiveSession(enhancedConfig, messageHandler);
            this.logger.log(`✅ On-demand Gemini session created for client: ${client.id}`);
            client.emit('session_created', {
                status: 'active',
                message: 'AI session started automatically.'
            });
            this.startGeminiHandlers(client, sessionData);
            this.logSessionStatus();
        }
        catch (error) {
            this.activeGeminiSessions--;
            this.logger.error(`Failed to create on-demand Gemini session: ${error.message}`);
            client.emit('error', { message: 'Failed to start AI session automatically' });
        }
        finally {
            sessionData.isCreatingSession = false;
        }
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
    (0, websockets_1.SubscribeMessage)('start_interaction'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], VoiceGateway.prototype, "handleStartInteraction", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('stop_interaction'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], VoiceGateway.prototype, "handleStopInteraction", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('get_session_status'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], VoiceGateway.prototype, "handleGetSessionStatus", null);
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