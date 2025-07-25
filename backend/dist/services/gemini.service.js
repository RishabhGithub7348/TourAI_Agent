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
var GeminiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiService = void 0;
const common_1 = require("@nestjs/common");
const genai_1 = require("@google/genai");
const config_service_1 = require("../config/config.service");
const memory_service_1 = require("./memory.service");
const tools_service_1 = require("./tools.service");
let GeminiService = GeminiService_1 = class GeminiService {
    constructor(configService, memoryService, toolsService) {
        this.configService = configService;
        this.memoryService = memoryService;
        this.toolsService = toolsService;
        this.logger = new common_1.Logger(GeminiService_1.name);
        this.MODEL = 'gemini-2.5-flash-preview-native-audio-dialog';
        this.client = new genai_1.GoogleGenAI({
            apiKey: this.configService.googleApiKey,
        });
    }
    async createLiveSession(config = {}, messageHandler) {
        try {
            const defaultConfig = {
                responseModalities: [genai_1.Modality.AUDIO],
                systemInstruction: "You are a helpful tour guide assistant. Answer in a friendly and informative tone.",
            };
            const responseQueue = [];
            let messageHandlerRef = messageHandler;
            const waitMessage = async () => {
                let done = false;
                let message = undefined;
                while (!done) {
                    message = responseQueue.shift();
                    if (message) {
                        done = true;
                    }
                    else {
                        await new Promise((resolve) => setTimeout(resolve, 100));
                    }
                }
                return message;
            };
            const callbacks = {
                onopen: () => {
                    this.logger.log('Gemini Live session opened');
                },
                onmessage: (message) => {
                    responseQueue.push(message);
                    if (messageHandlerRef) {
                        messageHandlerRef(message);
                    }
                },
                onerror: (error) => {
                    this.logger.error('Gemini Live API error:', error);
                },
                onclose: (event) => {
                    this.logger.log('Gemini Live session closed:', event.reason);
                },
            };
            const session = await this.client.live.connect({
                model: this.MODEL,
                config: defaultConfig,
                callbacks: callbacks,
            });
            const enhancedSession = {
                originalSession: session,
                responseQueue,
                waitMessage,
                sendClientContent: (data) => {
                    try {
                        session.sendClientContent(data);
                    }
                    catch (error) {
                        this.logger.error('Error sending client content to Gemini:', error);
                        throw error;
                    }
                },
                sendRealtimeInput: (data) => {
                    try {
                        session.sendRealtimeInput(data);
                    }
                    catch (error) {
                        this.logger.error('Error sending realtime input to Gemini:', error);
                        throw error;
                    }
                },
                sendToolResponse: (data) => {
                    try {
                        session.sendToolResponse(data);
                    }
                    catch (error) {
                        this.logger.error('Error sending tool response to Gemini:', error);
                        throw error;
                    }
                },
                close: () => {
                    try {
                        session.close();
                    }
                    catch (error) {
                        this.logger.error('Error closing session:', error);
                    }
                }
            };
            return enhancedSession;
        }
        catch (error) {
            this.logger.error(`Error creating live session: ${error.message}`);
            throw error;
        }
    }
    async handleFunctionCall(functionCall, userId) {
        const { name, args, id: callId } = functionCall;
        if (name === 'query_memory') {
            try {
                const memories = await this.memoryService.queryMemory(args.query, userId);
                const sortedMemories = memories
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 10);
                const memoryPoints = sortedMemories.map(mem => mem.memory);
                const memorySummary = 'Memory summary: ' + memoryPoints.join('; ');
                return {
                    id: callId,
                    name,
                    response: { result: memorySummary },
                };
            }
            catch (error) {
                this.logger.error(`Error in memory function call: ${error.message}`);
                return {
                    id: callId,
                    name,
                    response: { result: 'Memory query failed' },
                };
            }
        }
        const tourGuideTools = [
            'get_nearby_attractions',
            'get_directions',
            'get_dining_recommendations',
            'get_transportation_options'
        ];
        if (tourGuideTools.includes(name)) {
            return await this.toolsService.handleTourGuideFunction(functionCall);
        }
        return null;
    }
    async transcribeAudio(audioData) {
        try {
            if (!audioData) {
                return 'No audio data received.';
            }
            const prompt = `Generate a transcript of the speech. 
      Please do not include any other text in the response. 
      If you cannot hear the speech, please only say '<Not recognizable>'.`;
            const response = await this.client.models.generateContent({
                model: 'gemini-2.5-flash-lite',
                contents: [
                    {
                        parts: [
                            { text: prompt },
                            {
                                inlineData: {
                                    mimeType: 'audio/wav',
                                    data: audioData,
                                },
                            },
                        ],
                    },
                ],
            });
            return response.candidates?.[0]?.content?.parts?.[0]?.text || 'Transcription failed.';
        }
        catch (error) {
            this.logger.error(`Transcription error: ${error.message}`);
            return 'Transcription failed.';
        }
    }
};
exports.GeminiService = GeminiService;
exports.GeminiService = GeminiService = GeminiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.AppConfigService,
        memory_service_1.MemoryService,
        tools_service_1.ToolsService])
], GeminiService);
//# sourceMappingURL=gemini.service.js.map