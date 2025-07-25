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

  async createLiveSession(config: any = {}, messageHandler?: (data: any) => void) {
    try {
      // Simplified config similar to reference implementation
      const defaultConfig = {
        responseModalities: [Modality.AUDIO],
        systemInstruction: "You are a helpful tour guide assistant. Answer in a friendly and informative tone.",
      };

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
          this.logger.log('Gemini Live session closed:', event.reason);
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

  async handleFunctionCall(functionCall: any, userId: string): Promise<any> {
    const { name, args, id: callId } = functionCall;

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

    // Google Search and Code Execution are handled automatically by Gemini
    // We don't need to manually process them here
    
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