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
    getDefaultTools() {
        return [
            { googleSearch: {} },
            { codeExecution: {} },
            ...this.toolsService.getTourGuideTools().function_declarations.map(func => ({
                functionDeclarations: [func]
            }))
        ];
    }
    getVoiceForLanguage(languageCode) {
        const voiceMap = {
            'en-US': 'Charon',
            'en-GB': 'Aiden',
            'en-AU': 'Stella',
            'en-IN': 'Aoede',
            'es-ES': 'Fenix',
            'es-US': 'Fenix',
            'fr-FR': 'Nouvelle',
            'fr-CA': 'Nouvelle',
            'de-DE': 'Galia',
            'it-IT': 'Gioia',
            'pt-BR': 'Verde',
            'ja-JP': 'Yu',
            'ko-KR': 'Grover',
            'cmn-CN': 'Grover',
            'hi-IN': 'Kore',
            'ar-XA': 'Iris',
            'ru-RU': 'Luna',
            'vi-VN': 'Zari',
            'th-TH': 'Zari',
            'tr-TR': 'Zari',
            'nl-NL': 'Orion',
            'pl-PL': 'Luna',
            'id-ID': 'Zari',
            'bn-IN': 'Kore',
            'gu-IN': 'Kore',
            'kn-IN': 'Kore',
            'ml-IN': 'Kore',
            'mr-IN': 'Kore',
            'ta-IN': 'Kore',
            'te-IN': 'Kore'
        };
        return voiceMap[languageCode] || 'Charon';
    }
    getLanguageName(languageCode) {
        const languageNames = {
            'en-US': 'English (US)',
            'en-GB': 'English (UK)',
            'en-AU': 'English (Australia)',
            'en-IN': 'English (India)',
            'es-ES': 'Spanish (Spain)',
            'es-US': 'Spanish (US)',
            'fr-FR': 'French (France)',
            'fr-CA': 'French (Canada)',
            'de-DE': 'German',
            'it-IT': 'Italian',
            'pt-BR': 'Portuguese (Brazil)',
            'ja-JP': 'Japanese',
            'ko-KR': 'Korean',
            'cmn-CN': 'Mandarin Chinese',
            'hi-IN': 'Hindi',
            'ar-XA': 'Arabic',
            'ru-RU': 'Russian',
            'vi-VN': 'Vietnamese',
            'th-TH': 'Thai',
            'tr-TR': 'Turkish',
            'nl-NL': 'Dutch',
            'pl-PL': 'Polish',
            'id-ID': 'Indonesian',
            'bn-IN': 'Bengali',
            'gu-IN': 'Gujarati',
            'kn-IN': 'Kannada',
            'ml-IN': 'Malayalam',
            'mr-IN': 'Marathi',
            'ta-IN': 'Tamil',
            'te-IN': 'Telugu'
        };
        return languageNames[languageCode] || 'English';
    }
    async createLiveSession(config = {}, messageHandler) {
        try {
            let locationContext = '';
            if (config.locationContext) {
                const location = config.locationContext;
                locationContext = `

CURRENT USER LOCATION: ${location}

LOCATION-SPECIFIC GUIDANCE:
- You currently know the user's general location (country/state)
- Use Google Search to find current events, attractions, and activities in this area
- When you need more specific location details for precise recommendations, ask the user politely and explain why
- For example: "To give you the best local recommendations, could you please share which city or area you're in within [state]? This will help me find the most relevant attractions and activities near you."
- Consider local customs, languages, and cultural norms for this region
- Suggest optimal times to visit attractions based on the current season
- Recommend authentic local experiences and dining options
- Always search for the most current information about attractions, events, and local conditions`;
            }
            let languageContext = '';
            if (config.language && config.language !== 'en-US') {
                const languageName = this.getLanguageName(config.language);
                languageContext = `

LANGUAGE PREFERENCE: ${languageName} (${config.language})

LANGUAGE-SPECIFIC GUIDANCE:
- The user prefers communication in ${languageName}
- Respond primarily in ${languageName} while maintaining tour guide expertise
- Include local phrases and greetings when appropriate
- Be culturally sensitive to the linguistic region
- When mentioning places or attractions, provide names in both local language and English if different
- Consider cultural context specific to ${languageName}-speaking regions`;
            }
            const defaultConfig = {
                responseModalities: [genai_1.Modality.AUDIO],
                inputAudioTranscription: {},
                outputAudioTranscription: {},
                ...(config.language && {
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: this.getVoiceForLanguage(config.language)
                            }
                        }
                    }
                }),
                systemInstruction: `You are an expert tour guide assistant with access to powerful tools and real-time information.${locationContext}${languageContext}

CORE CAPABILITIES:
- Provide comprehensive travel and tourism information
- Access real-time data through Google Search
- Offer personalized recommendations based on user preferences
- Guide users through destinations with detailed descriptions
- Present information in an engaging, friendly, and professional manner

AVAILABLE TOOLS:
1. Google Search - Use to find current information about attractions, events, weather, transportation, dining options, and local insights
2. Code Execution - For calculations, data analysis, and computational tasks
3. Memory System - Access user preferences and past interactions for personalized recommendations
4. Location Services - Get nearby attractions, directions, dining recommendations, and transportation options
5. Bookmark System - Save and retrieve user's favorite places and recommendations
6. Real-time Audio - Communicate naturally through voice interactions

BOOKMARK FUNCTIONALITY:
- PROACTIVELY offer to save ANY interesting content during conversations (not just places)
- Save food recommendations, stories, memories, tips, experiences, places, accommodations - ANYTHING the user finds interesting
- Watch for user reactions like "that sounds great", "I'd love to try that", "interesting", "I should remember that"
- Automatically ask: "Would you like me to save this for you?" when sharing interesting content
- Use save_bookmark function when users say "save this", "bookmark this", "remember this", or show interest
- Use get_bookmarks function when users ask to see their saved items
- Categories: food, place, memory, tip, accommodation, general
- Build their personal collection of memories and recommendations from conversations

PRESENTATION STYLE:
- Be enthusiastic and knowledgeable about destinations
- Provide practical, actionable advice
- Include interesting historical facts, local customs, and insider tips
- Adapt your communication style to the user's preferences
- Ask follow-up questions to better understand user needs

SEARCH STRATEGY:
- Always search for the most current information when discussing events, prices, hours, or seasonal activities
- Cross-reference multiple sources for accuracy
- Provide specific details like addresses, phone numbers, and websites when available
- Include practical information like opening hours, ticket prices, and accessibility

INTERACTION APPROACH:
- Start with general recommendations based on the user's known location
- When more precision is needed, ask politely with context: "To provide you with the most accurate directions and local tips, would you mind sharing which city you're visiting in [state]?"
- Always explain the benefit: "This will help me recommend places within walking distance and give you the best local insights"
- Use their responses to provide increasingly targeted suggestions
- Be respectful of privacy - never pressure users to share more than they're comfortable with
- PROACTIVELY offer bookmarks: After sharing interesting content, ask "Would you like me to save this for you?"
- Pay attention to user enthusiasm and offer to save things they seem excited about
- Remember: You're creating memorable travel experiences through knowledgeable, personalized guidance`,
                tools: config.tools || this.getDefaultTools(),
                ...config
            };
            delete defaultConfig.locationContext;
            delete defaultConfig.language;
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
            const handleTurn = async () => {
                const turns = [];
                let done = false;
                while (!done) {
                    const message = await waitMessage();
                    turns.push(message);
                    if (message.serverContent && message.serverContent.turnComplete) {
                        done = true;
                    }
                    else if (message.toolCall) {
                        done = true;
                    }
                }
                return turns;
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
                    const reason = event.reason || 'Unknown';
                    this.logger.log('Gemini Live session closed:', reason);
                    if (reason.includes('quota') || reason.includes('exceeded')) {
                        this.logger.error('❌ QUOTA EXCEEDED: Gemini API quota limit reached. Consider implementing rate limiting or upgrading your plan.');
                    }
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
                handleTurn,
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
                sendAudioStreamEnd: () => {
                    try {
                        session.sendRealtimeInput({ audioStreamEnd: true });
                    }
                    catch (error) {
                        this.logger.error('Error sending audio stream end to Gemini:', error);
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
    async createLiveSessionWithTools(tools, additionalConfig = {}, messageHandler) {
        const config = {
            ...additionalConfig,
            tools: tools
        };
        return this.createLiveSession(config, messageHandler);
    }
    async handleFunctionCall(functionCall, userId) {
        const { name, args, id: callId } = functionCall;
        this.logger.log(`Processing function call: ${name} with args: ${JSON.stringify(args)}`);
        if (name === 'googleSearch' || name === 'google_search' || name === 'codeExecution' || name === 'code_execution') {
            this.logger.log(`${name} is handled automatically by Gemini - no response needed`);
            return null;
        }
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
            'get_transportation_options',
            'save_bookmark',
            'get_bookmarks'
        ];
        if (tourGuideTools.includes(name)) {
            console.log(`🔧 GeminiService - Calling tour guide function ${name} with userId: ${userId}`);
            return await this.toolsService.handleTourGuideFunction(functionCall, userId);
        }
        this.logger.log(`Unknown function call: ${name} - returning null`);
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