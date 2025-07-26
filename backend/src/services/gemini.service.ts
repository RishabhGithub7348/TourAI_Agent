import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI, Modality } from '@google/genai';
import { AppConfigService } from '../config/config.service';
import { MemoryService } from './memory.service';
import { ToolsService } from './tools.service';
import { ConversationMessage, WebSocketMessage } from '../interfaces/conversation.interface';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private client: GoogleGenAI;
  private readonly MODEL = 'gemini-2.5-flash-preview-native-audio-dialog';

  constructor(
    private configService: AppConfigService,
    private memoryService: MemoryService,
    private toolsService: ToolsService,
  ) {
    this.client = new GoogleGenAI({
      apiKey: this.configService.googleApiKey,
    });
  }

  // Get default tools configuration for Gemini Live API
  private getDefaultTools() {
    return [
      { googleSearch: {} },
      { codeExecution: {} }
    ];
  }

  async createLiveSession(config: any = {}, messageHandler?: (data: any) => void) {
    try {
      // Build location-aware system instruction
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

      // Enhanced config with tools support and transcription
      const defaultConfig = {
        responseModalities: [Modality.AUDIO],
        inputAudioTranscription: {}, // Enable input transcription for VAD
        outputAudioTranscription: {}, // Enable output transcription
        systemInstruction: `You are an expert tour guide assistant with access to powerful tools and real-time information.${locationContext}

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
5. Real-time Audio - Communicate naturally through voice interactions

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
- Remember: You're creating memorable travel experiences through knowledgeable, personalized guidance`,
        tools: config.tools || this.getDefaultTools(),
        ...config
      };
      
      // Remove locationContext from config before sending to Gemini (it's only for our system instruction)
      delete defaultConfig.locationContext;

      // Response queue for handling async messages (similar to reference)
      const responseQueue: any[] = [];
      let messageHandlerRef = messageHandler;

      // Helper function to wait for messages (reference implementation pattern)
      const waitMessage = async (): Promise<any> => {
        let done = false;
        let message = undefined;
        while (!done) {
          message = responseQueue.shift();
          if (message) {
            done = true;
          } else {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }
        return message;
      };

      // Helper function to handle turns like in the reference
      const handleTurn = async (): Promise<any[]> => {
        const turns = [];
        let done = false;
        while (!done) {
          const message = await waitMessage();
          turns.push(message);
          if (message.serverContent && message.serverContent.turnComplete) {
            done = true;
          } else if (message.toolCall) {
            done = true;
          }
        }
        return turns;
      };

      // Set up callbacks for the live session
      const callbacks = {
        onopen: () => {
          this.logger.log('Gemini Live session opened');
        },
        onmessage: (message: any) => {
          responseQueue.push(message);
          if (messageHandlerRef) {
            messageHandlerRef(message);
          }
        },
        onerror: (error: any) => {
          this.logger.error('Gemini Live API error:', error);
        },
        onclose: (event: any) => {
          const reason = event.reason || 'Unknown';
          this.logger.log('Gemini Live session closed:', reason);
          
          // Log quota exceeded errors more clearly
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
      
      // Store the session with proper message handling and queue access
      const enhancedSession = {
        originalSession: session,
        responseQueue,
        waitMessage,
        handleTurn,
        sendClientContent: (data: any) => {
          try {
            session.sendClientContent(data);
          } catch (error) {
            this.logger.error('Error sending client content to Gemini:', error);
            throw error;
          }
        },
        sendRealtimeInput: (data: any) => {
          try {
            session.sendRealtimeInput(data);
          } catch (error) {
            this.logger.error('Error sending realtime input to Gemini:', error);
            throw error;
          }
        },
        sendAudioStreamEnd: () => {
          try {
            session.sendRealtimeInput({ audioStreamEnd: true });
          } catch (error) {
            this.logger.error('Error sending audio stream end to Gemini:', error);
            throw error;
          }
        },
        sendToolResponse: (data: any) => {
          try {
            session.sendToolResponse(data);
          } catch (error) {
            this.logger.error('Error sending tool response to Gemini:', error);
            throw error;
          }
        },
        close: () => {
          try {
            session.close();
          } catch (error) {
            this.logger.error('Error closing session:', error);
          }
        }
      };
      
      return enhancedSession;
    } catch (error) {
      this.logger.error(`Error creating live session: ${error.message}`);
      throw error;
    }
  }

  // Create a session with custom tools (like your example)
  async createLiveSessionWithTools(tools: any[], additionalConfig: any = {}, messageHandler?: (data: any) => void) {
    const config = {
      ...additionalConfig,
      tools: tools
    };
    return this.createLiveSession(config, messageHandler);
  }

  async handleFunctionCall(functionCall: any, userId: string): Promise<any> {
    const { name, args, id: callId } = functionCall;

    this.logger.log(`Processing function call: ${name} with args: ${JSON.stringify(args)}`);

    // Google Search and Code Execution are handled automatically by Gemini Live API
    // We only need to handle custom functions
    if (name === 'googleSearch' || name === 'google_search' || name === 'codeExecution' || name === 'code_execution') {
      this.logger.log(`${name} is handled automatically by Gemini - no response needed`);
      return null;
    }

    // Handle memory queries
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
      } catch (error) {
        this.logger.error(`Error in memory function call: ${error.message}`);
        return {
          id: callId,
          name,
          response: { result: 'Memory query failed' },
        };
      }
    }

    // Handle tour guide functions
    const tourGuideTools = [
      'get_nearby_attractions', 
      'get_directions',
      'get_dining_recommendations',
      'get_transportation_options'
    ];

    if (tourGuideTools.includes(name)) {
      return await this.toolsService.handleTourGuideFunction(functionCall);
    }

    this.logger.log(`Unknown function call: ${name} - returning null`);
    return null;
  }

  async transcribeAudio(audioData: string): Promise<string> {
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
    } catch (error) {
      this.logger.error(`Transcription error: ${error.message}`);
      return 'Transcription failed.';
    }
  }
}