import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { UseFilters } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { GeminiService } from '../services/gemini.service';
import { MemoryService } from '../services/memory.service';
import { AudioUtils } from '../utils/audio.utils';
import { WebSocketMessage, ConversationMessage } from '../interfaces/conversation.interface';
import { WsExceptionFilter } from '../filters/ws-exception.filter';

interface SessionData {
  sessionId: string;
  userId: string;
  location?: string;
  geminiSession: any;
  currentConversation: ConversationMessage[];
  hasUserAudio: boolean;
  userAudioBuffer: Buffer;
  hasAssistantAudio: boolean;
  assistantAudioBuffer: Buffer;
  shouldAccumulateUserAudio: boolean;
  audioResponseQueue: any[];
  isProcessingAudioResponse: boolean;
}

@WebSocketGateway(9084, {
  cors: {
    origin: '*',
  },
  compression: false,
})
@UseFilters(WsExceptionFilter)
export class VoiceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(VoiceGateway.name);
  private sessions = new Map<string, SessionData>();

  constructor(
    private geminiService: GeminiService,
    private memoryService: MemoryService,
  ) {}

  async handleConnection(@ConnectedSocket() client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    
    const sessionId = uuidv4();
    const userId = this.memoryService.getUserId(sessionId);
    
    const sessionData: SessionData = {
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

  handleDisconnect(@ConnectedSocket() client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    
    const sessionData = this.sessions.get(client.id);
    if (sessionData?.geminiSession) {
      try {
        sessionData.geminiSession.close?.();
      } catch (error) {
        this.logger.error(`Error closing Gemini session: ${error.message}`);
      }
    }
    
    this.sessions.delete(client.id);
  }

  @SubscribeMessage('setup')
  async handleSetup(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    try {
      const sessionData = this.sessions.get(client.id);
      if (!sessionData) {
        client.emit('error', { message: 'Session not found' });
        return;
      }

      const config = data.setup || {};
      
      // Store user location if provided
      if (config.location) {
        sessionData.location = config.location;
        this.logger.log(`User location set for client ${client.id}: ${config.location}`);
      }
      
      // Simplified config to avoid invalid argument errors
      const enhancedConfig = {
        responseModalities: ['AUDIO'],
        systemInstruction: "You are a helpful tour guide assistant. Answer in a friendly and informative tone."
      };
      
      // Create message handler for Gemini responses (similar to reference implementation)
      const messageHandler = (data: any) => {
        try {
          this.handleGeminiMessage(client, sessionData, data);
        } catch (error) {
          this.logger.error(`Error in message handler: ${error.message}`);
          client.emit('error', { message: 'Failed to process response' });
        }
      };

      sessionData.geminiSession = await this.geminiService.createLiveSession(enhancedConfig, messageHandler);
      
      this.logger.log(`Gemini session created for client: ${client.id}${config.location ? ` with location: ${config.location}` : ''}`);
      client.emit('setup_complete', { status: 'ready', location: config.location });

      this.startGeminiHandlers(client, sessionData);
    } catch (error) {
      this.logger.error(`Setup error: ${error.message}`);
      client.emit('error', { message: 'Setup failed' });
    }
  }

  @SubscribeMessage('realtime_input')
  async handleRealtimeInput(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: WebSocketMessage,
  ) {
    const sessionData = this.sessions.get(client.id);
    if (!sessionData?.geminiSession) {
      return;
    }

    try {
      if (data.realtime_input) {
        for (const chunk of data.realtime_input.media_chunks) {
          if (chunk.mime_type === 'audio/pcm' || chunk.mime_type === 'audio/webm') {
            // Send audio directly to Gemini Live API
            if (sessionData.geminiSession && sessionData.geminiSession.sendRealtimeInput) {
              try {
                sessionData.geminiSession.sendRealtimeInput({
                  audio: {
                    data: chunk.data,
                    mimeType: chunk.mime_type === 'audio/pcm' ? 'audio/pcm;rate=16000' : chunk.mime_type
                  }
                });
                
                this.logger.log(`Sent audio chunk to Gemini: ${chunk.mime_type}, size: ${chunk.data.length}`);
              } catch (error) {
                this.logger.error(`Error sending audio to Gemini: ${error.message}`);
              }
            }

            // Also accumulate for backup transcription if needed
            if (sessionData.shouldAccumulateUserAudio) {
              try {
                const audioChunk = AudioUtils.base64ToBuffer(chunk.data);
                sessionData.hasUserAudio = true;
                sessionData.userAudioBuffer = Buffer.concat([
                  sessionData.userAudioBuffer,
                  audioChunk,
                ]);
              } catch (error) {
                this.logger.error(`Error processing audio chunk: ${error.message}`);
              }
            }
          } else if (chunk.mime_type.startsWith('image/')) {
            sessionData.currentConversation.push({
              role: 'user',
              content: '[Image shared by user]',
            });

            // Send image to Gemini Live API
            if (sessionData.geminiSession && sessionData.geminiSession.sendRealtimeInput) {
              try {
                sessionData.geminiSession.sendRealtimeInput({
                  media: {
                    data: chunk.data,
                    mimeType: chunk.mime_type
                  }
                });
              } catch (error) {
                this.logger.error(`Error sending image to Gemini: ${error.message}`);
              }
            }
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error handling realtime input: ${error.message}`);
    }
  }

  @SubscribeMessage('text')
  async handleTextInput(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { text: string },
  ) {
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

      // Send text message to Gemini Live API
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
        } catch (error) {
          this.logger.error(`Error sending text to Gemini: ${error.message}`);
          client.emit('error', { message: 'Failed to process message' });
        }
      } else {
        client.emit('error', { message: 'No active Gemini session' });
      }
    } catch (error) {
      this.logger.error(`Error handling text input: ${error.message}`);
      client.emit('error', { message: 'Failed to process message' });
    }
  }

  private handleGeminiMessage(client: Socket, sessionData: SessionData, message: any) {
    try {
      this.logger.log('Received message from Gemini:', JSON.stringify(message, null, 2));

      // Handle audio data responses (similar to reference implementation)
      if (message.data) {
        sessionData.audioResponseQueue.push(message);
        
        // Process audio queue if not already processing
        if (!sessionData.isProcessingAudioResponse) {
          this.processAudioQueue(client, sessionData);
        }
        return;
      }

      // Handle server content responses
      if (message.serverContent) {
        const { modelTurn, turnComplete } = message.serverContent;
        
        if (modelTurn && modelTurn.parts) {
          for (const part of modelTurn.parts) {
            // Handle text responses
            if (part.text) {
              client.emit('text', { text: part.text });
              sessionData.currentConversation.push({
                role: 'assistant',
                content: part.text,
              });
            }
            
            // Handle inline audio responses (fallback)
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

      // Handle tool calls
      if (message.toolCall) {
        this.handleGeminiFunctionCall(client, sessionData, message.toolCall);
      }

      // Handle setup completion
      if (message.setupComplete) {
        this.logger.log('Gemini Live session setup completed');
      }

    } catch (error) {
      this.logger.error(`Error handling Gemini message: ${error.message}`);
    }
  }

  private async processAudioQueue(client: Socket, sessionData: SessionData) {
    if (sessionData.isProcessingAudioResponse || sessionData.audioResponseQueue.length === 0) {
      return;
    }

    sessionData.isProcessingAudioResponse = true;
    
    try {
      // Wait for turn completion or timeout
      await this.waitForAudioTurnComplete(sessionData);
      
      // Combine all audio chunks
      const combinedAudio = this.combineAudioChunks(sessionData.audioResponseQueue);
      
      if (combinedAudio) {
        this.logger.log(`Sending combined audio response, length: ${combinedAudio.length}`);
        client.emit('audio', { audio: combinedAudio });
      }
      
      // Clear the queue
      sessionData.audioResponseQueue = [];
      
    } catch (error) {
      this.logger.error(`Error processing audio queue: ${error.message}`);
    } finally {
      sessionData.isProcessingAudioResponse = false;
    }
  }

  private async waitForAudioTurnComplete(sessionData: SessionData, timeoutMs: number = 2000): Promise<void> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const checkComplete = () => {
        // Check if we have a turn complete signal or timeout
        if (Date.now() - startTime > timeoutMs) {
          resolve();
          return;
        }
        
        // Continue waiting
        setTimeout(checkComplete, 100);
      };
      
      checkComplete();
    });
  }

  private combineAudioChunks(audioQueue: any[]): string | null {
    try {
      const audioBuffers: Buffer[] = [];
      
      for (const message of audioQueue) {
        if (message.data) {
          const buffer = Buffer.from(message.data, 'base64');
          audioBuffers.push(buffer);
        }
      }
      
      if (audioBuffers.length === 0) {
        return null;
      }
      
      // Combine all audio buffers
      const combinedBuffer = Buffer.concat(audioBuffers);
      
      // Convert to WAV format for playback (24kHz output from Gemini)
      const wavBase64 = AudioUtils.convertBase64PcmToWav(combinedBuffer.toString('base64'), 24000);
      
      return wavBase64;
    } catch (error) {
      this.logger.error(`Error combining audio chunks: ${error.message}`);
      return null;
    }
  }

  private async handleGeminiFunctionCall(client: Socket, sessionData: SessionData, toolCall: any) {
    try {
      const result = await this.geminiService.handleFunctionCall(toolCall, sessionData.userId);
      
      if (result && sessionData.geminiSession && sessionData.geminiSession.sendToolResponse) {
        sessionData.geminiSession.sendToolResponse({
          functionResponses: [result]
        });
      }
    } catch (error) {
      this.logger.error(`Error handling function call: ${error.message}`);
    }
  }

  private async startGeminiHandlers(client: Socket, sessionData: SessionData) {
    try {
      if (!sessionData.geminiSession) {
        this.logger.error('No Gemini session available');
        return;
      }

      // Don't send initial greeting immediately - wait for user input
      // The session is ready to receive audio/text input
      this.logger.log('Gemini handlers started for client:', client.id);
      
      // Send a simple welcome message to frontend instead
      const welcomeMessage = sessionData.location 
        ? `Hello! I'm your AI tour guide. I see you're currently in ${sessionData.location}. How can I help you explore this area today?`
        : `Hello! I'm your AI tour guide. How can I help you explore today? Feel free to share your location for personalized recommendations.`;
      
      client.emit('text', { text: welcomeMessage });
      
    } catch (error) {
      this.logger.error(`Fatal error in Gemini handlers: ${error.message}`);
      client.emit('error', { message: 'Failed to start AI session' });
    }
  }

  private async handleTurnComplete(client: Socket, sessionData: SessionData) {
    let userText: string | null = null;
    let assistantText: string | null = null;

    if (sessionData.hasUserAudio && sessionData.userAudioBuffer.length > 0) {
      try {
        const userWavBase64 = AudioUtils.convertPcmToWav(sessionData.userAudioBuffer, true);
        if (userWavBase64) {
          userText = await this.geminiService.transcribeAudio(userWavBase64);
          this.logger.log(`Transcribed user audio: ${userText}`);
        } else {
          userText = 'User audio could not be processed.';
        }
      } catch (error) {
        this.logger.error(`Error processing user audio: ${error.message}`);
        userText = 'User audio processing error.';
      }
    }

    if (sessionData.hasAssistantAudio && sessionData.assistantAudioBuffer.length > 0) {
      try {
        const assistantWavBase64 = AudioUtils.convertPcmToWav(sessionData.assistantAudioBuffer, false);
        if (assistantWavBase64) {
          assistantText = await this.geminiService.transcribeAudio(assistantWavBase64);
          if (assistantText) {
            client.emit('text', { text: assistantText });
          }
        } else {
          assistantText = 'Assistant audio could not be processed.';
        }
      } catch (error) {
        this.logger.error(`Error processing assistant audio: ${error.message}`);
        assistantText = 'Assistant audio processing error.';
      }
    }

    if (userText && assistantText) {
      const messages: ConversationMessage[] = [
        { role: 'user', content: userText },
        { role: 'assistant', content: assistantText },
      ];
      
      await this.memoryService.addToMemory(messages, sessionData.userId);
      this.logger.log('Turn complete, memory updated');
    } else {
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
}