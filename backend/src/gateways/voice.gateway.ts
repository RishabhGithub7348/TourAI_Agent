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
import { WebSocketMessage, ConversationMessage, AudioData, MediaData } from '../interfaces/conversation.interface';
import { WsExceptionFilter } from '../filters/ws-exception.filter';

interface SessionData {
  sessionId: string;
  userId: string;
  location?: string;
  language?: string;
  geminiSession: any;
  currentConversation: ConversationMessage[];
  hasUserAudio: boolean;
  userAudioBuffer: Buffer;
  hasAssistantAudio: boolean;
  assistantAudioBuffer: Buffer;
  shouldAccumulateUserAudio: boolean;
  audioResponseQueue: any[];
  isProcessingAudioResponse: boolean;
  isCreatingSession: boolean; 
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
  
  // Connection management to prevent API quota exceeded
  private readonly MAX_CONCURRENT_CONNECTIONS = 3; // Limit concurrent Gemini sessions
  private activeGeminiSessions = 0;

  // Debug method to check session consistency
  private logSessionStatus() {
    const actualActiveSessions = Array.from(this.sessions.values()).filter(
      session => session.geminiSession !== null
    ).length;
    
    if (actualActiveSessions !== this.activeGeminiSessions) {
      this.logger.warn(`⚠️ Session counter mismatch! Counter: ${this.activeGeminiSessions}, Actual: ${actualActiveSessions}`);
    } else {
      this.logger.debug(`✅ Session counter accurate: ${this.activeGeminiSessions}/${this.MAX_CONCURRENT_CONNECTIONS}`);
    }
  }

  constructor(
    private geminiService: GeminiService,
    private memoryService: MemoryService,
  ) {}

  async handleConnection(@ConnectedSocket() client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    
    const sessionId = uuidv4();
    // We'll set userId later when we receive the setup message
    
    const sessionData: SessionData = {
      sessionId,
      userId: 'pending', // Will be updated in setup
      geminiSession: null, // Will be created on-demand
      currentConversation: [],
      hasUserAudio: false,
      userAudioBuffer: Buffer.alloc(0),
      hasAssistantAudio: false,
      assistantAudioBuffer: Buffer.alloc(0),
      shouldAccumulateUserAudio: true,
      audioResponseQueue: [],
      isProcessingAudioResponse: false,
      isCreatingSession: false, // Initialize session creation state
    };

    this.sessions.set(client.id, sessionData);
    
    // Just send connection confirmation, no immediate session creation
    client.emit('connected', { 
      sessionId, 
      userId: 'pending',
      status: 'ready_for_interaction' // Indicates session not created yet
    });
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    this.logger.log(`🔌 Client disconnected: ${client.id}`);
    
    const sessionData = this.sessions.get(client.id);
    if (sessionData) {
      // Close active Gemini session if exists
      if (sessionData.geminiSession) {
        try {
          sessionData.geminiSession.close?.();
          // Decrement active sessions counter
          this.activeGeminiSessions = Math.max(0, this.activeGeminiSessions - 1);
          this.logger.log(`🛑 Gemini session closed due to disconnect. Active sessions: ${this.activeGeminiSessions}/${this.MAX_CONCURRENT_CONNECTIONS}`);
        } catch (error) {
          this.logger.error(`Error closing Gemini session on disconnect: ${error.message}`);
        }
      }
      
      // Handle case where session was being created but not finished
      if (sessionData.isCreatingSession) {
        // If session was being created, we need to potentially decrement counter
        // This handles race condition where session creation was in progress
        this.activeGeminiSessions = Math.max(0, this.activeGeminiSessions - 1);
        this.logger.log(`🧹 Cleaned up session creation in progress for disconnected client. Active sessions: ${this.activeGeminiSessions}/${this.MAX_CONCURRENT_CONNECTIONS}`);
      }
      
      // Clear all session buffers and state
      if (sessionData.userAudioBuffer) {
        sessionData.userAudioBuffer = Buffer.alloc(0);
      }
      if (sessionData.assistantAudioBuffer) {
        sessionData.assistantAudioBuffer = Buffer.alloc(0);
      }
      sessionData.audioResponseQueue = [];
    }
    
    // Remove session data
    this.sessions.delete(client.id);
    this.logger.log(`🗑️ Session data cleaned up for client: ${client.id}`);
    
    // Log session status for debugging
    this.logSessionStatus();
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
      
      // Set user ID from frontend (Clerk user ID)
      if (config.userId) {
        sessionData.userId = config.userId;
        this.logger.log(`✅ User ID set for client ${client.id}: ${config.userId}`);
        console.log(`📋 User ID received from frontend: ${config.userId}`);
      } else {
        // Fallback to default user ID if not provided
        sessionData.userId = this.memoryService.getUserId(sessionData.sessionId);
        this.logger.log(`⚠️ No user ID provided, using fallback: ${sessionData.userId}`);
        console.log(`⚠️ No user ID from frontend, using fallback: ${sessionData.userId}`);
      }
      
      // Store user location if provided (but don't create session yet)
      if (config.location) {
        sessionData.location = config.location;
        this.logger.log(`User location set for client ${client.id}: ${config.location}`);
      }
      
      // Just acknowledge setup, don't create Gemini session yet
      this.logger.log(`Setup completed for client: ${client.id}. Waiting for user interaction to create session.`);
      client.emit('setup_complete', { 
        status: 'waiting_for_interaction', 
        location: config.location,
        userId: sessionData.userId,
        message: 'Ready to start. Click the audio button to begin conversation.'
      });

    } catch (error) {
      this.logger.error(`Setup error: ${error.message}`);
      client.emit('error', { message: 'Setup failed' });
    }
  }

  @SubscribeMessage('start_interaction')
  async handleStartInteraction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    try {
      const sessionData = this.sessions.get(client.id);
      if (!sessionData) {
        client.emit('error', { message: 'Session not found' });
        return;
      }

      // Store simplified location data if provided
      if (data.location) {
        const loc = data.location;
        const locationParts = [];
        
        this.logger.log(`📍 Raw location data received for client ${client.id}:`, {
          city: loc.city || 'NOT PROVIDED',
          state: loc.state || 'NOT PROVIDED', 
          country: loc.country || 'NOT PROVIDED'
        });
        
        if (loc.city) locationParts.push(loc.city);
        if (loc.state) locationParts.push(loc.state);
        if (loc.country) locationParts.push(loc.country);
        
        sessionData.location = locationParts.join(', ') || 'Unknown location';
        this.logger.log(`🌍 Final processed location for client ${client.id}: ${sessionData.location}`);
      }

      // Store language preference if provided
      const language = data.language || 'en-US';
      sessionData.language = language;
      this.logger.log(`🗣️ Language preference for client ${client.id}: ${language}`);

      // Check if session already exists or is being created
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

      // Check if we've reached the connection limit
      if (this.activeGeminiSessions >= this.MAX_CONCURRENT_CONNECTIONS) {
        this.logger.warn(`Connection limit reached (${this.activeGeminiSessions}/${this.MAX_CONCURRENT_CONNECTIONS}). Rejecting client: ${client.id}`);
        client.emit('error', { 
          message: 'Server is at capacity. Please try again in a few moments.',
          code: 'CONNECTION_LIMIT_REACHED'
        });
        return;
      }

      // Now create the Gemini session with location context and language
      const enhancedConfig = {
        responseModalities: ['AUDIO'],
        locationContext: sessionData.location, // Pass simplified location
        language: language // Pass language preference
      };
      
      const messageHandler = (data: any) => {
        try {
          this.handleGeminiMessage(client, sessionData, data);
        } catch (error) {
          this.logger.error(`Error in message handler: ${error.message}`);
          client.emit('error', { message: 'Failed to process response' });
        }
      };

      try {
        // Set flag to prevent duplicate creation
        sessionData.isCreatingSession = true;
        
        // Increment counter before creating session
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
      } catch (error) {
        // Decrement counter if session creation failed
        this.activeGeminiSessions--;
        this.logger.error(`Failed to create Gemini session: ${error.message}`);
        client.emit('error', { message: 'Failed to start AI session' });
      } finally {
        // Always clear the flag when done
        sessionData.isCreatingSession = false;
      }
    } catch (error) {
      this.logger.error(`Start interaction error: ${error.message}`);
      client.emit('error', { message: 'Failed to start interaction' });
    }
  }

  @SubscribeMessage('stop_interaction')
  async handleStopInteraction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    try {
      const sessionData = this.sessions.get(client.id);
      if (!sessionData) {
        client.emit('error', { message: 'Session not found' });
        return;
      }

      // Close existing Gemini session if it exists
      if (sessionData.geminiSession) {
        try {
          sessionData.geminiSession.close?.();
          sessionData.geminiSession = null;
          
          // Decrement active sessions counter
          this.activeGeminiSessions = Math.max(0, this.activeGeminiSessions - 1);
          this.logger.log(`🛑 User stopped interaction. Gemini session closed for client: ${client.id}. Active sessions: ${this.activeGeminiSessions}/${this.MAX_CONCURRENT_CONNECTIONS}`);
          
          // Reset session state
          sessionData.audioResponseQueue = [];
          sessionData.isProcessingAudioResponse = false;
          sessionData.hasUserAudio = false;
          sessionData.hasAssistantAudio = false;
          sessionData.userAudioBuffer = Buffer.alloc(0);
          sessionData.assistantAudioBuffer = Buffer.alloc(0);
          sessionData.isCreatingSession = false; // Reset session creation flag
          
          client.emit('interaction_stopped', { 
            status: 'stopped',
            message: 'AI session ended. Click the audio button to start a new session.'
          });
          
          // Log session status for debugging
          this.logSessionStatus();
        } catch (error) {
          this.logger.error(`Error closing Gemini session: ${error.message}`);
          client.emit('error', { message: 'Error stopping session' });
        }
      } else {
        client.emit('interaction_stopped', { 
          status: 'not_active',
          message: 'No active session to stop.'
        });
      }
    } catch (error) {
      this.logger.error(`Stop interaction error: ${error.message}`);
      client.emit('error', { message: 'Failed to stop interaction' });
    }
  }

  @SubscribeMessage('get_session_status')
  async handleGetSessionStatus(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    const totalSessions = this.sessions.size;
    const activeSessions = Array.from(this.sessions.values()).filter(
      session => session.geminiSession !== null
    ).length;
    const creatingSessions = Array.from(this.sessions.values()).filter(
      session => session.isCreatingSession
    ).length;

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

  @SubscribeMessage('realtime_input')
  async handleRealtimeInput(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: WebSocketMessage,
  ) {
    const sessionData = this.sessions.get(client.id);
    if (!sessionData) {
      client.emit('error', { message: 'Session not found' });
      return;
    }

    // Create session on-demand if not exists and not already creating
    if (!sessionData.geminiSession && !sessionData.isCreatingSession) {
      await this.createSessionOnDemand(client, sessionData);
      if (!sessionData.geminiSession) {
        return; // Session creation failed
      }
    } else if (sessionData.isCreatingSession) {
      // Session is being created, queue this request or drop it
      this.logger.debug(`Session creation in progress for client: ${client.id}, dropping request`);
      return;
    }

    try {
      // Handle direct audio format (from documentation)
      if (data.audio) {
        if (sessionData.geminiSession && sessionData.geminiSession.sendRealtimeInput) {
          try {
            // Type guard to check if audio is AudioData object or string
            if (typeof data.audio === 'object' && 'data' in data.audio) {
              const audioData = data.audio as AudioData;
              sessionData.geminiSession.sendRealtimeInput({
                audio: {
                  data: audioData.data,
                  mimeType: audioData.mimeType || 'audio/pcm;rate=16000'
                }
              });
              
              this.logger.debug(`Sent audio to Gemini: ${audioData.mimeType || 'audio/pcm;rate=16000'}`);
            } else {
              // Handle legacy string format
              sessionData.geminiSession.sendRealtimeInput({
                audio: {
                  data: data.audio as string,
                  mimeType: 'audio/pcm;rate=16000'
                }
              });
              
              this.logger.debug(`Sent audio to Gemini: audio/pcm;rate=16000`);
            }
          } catch (error) {
            this.logger.error(`Error sending audio to Gemini: ${error.message}`);
          }
        }
        return;
      }

      // Handle audio stream end signal
      if (data.audioStreamEnd) {
        if (sessionData.geminiSession && sessionData.geminiSession.sendAudioStreamEnd) {
          try {
            sessionData.geminiSession.sendAudioStreamEnd();
            this.logger.debug('Sent audio stream end signal to Gemini');
          } catch (error) {
            this.logger.error(`Error sending audio stream end: ${error.message}`);
          }
        }
        return;
      }

      // Handle media format
      if (data.media) {
        if (sessionData.geminiSession && sessionData.geminiSession.sendRealtimeInput) {
          try {
            const mediaData = data.media as MediaData;
            sessionData.geminiSession.sendRealtimeInput({
              audio: {
                data: mediaData.data,
                mimeType: mediaData.mimeType || 'audio/pcm;rate=16000'
              }
            });
            
            this.logger.debug(`Sent media to Gemini: ${mediaData.mimeType || 'audio/pcm;rate=16000'}`);
          } catch (error) {
            this.logger.error(`Error sending media to Gemini: ${error.message}`);
          }
        }
        return;
      }

      // Handle legacy format for backward compatibility
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
                
                this.logger.debug(`Sent audio chunk to Gemini: ${chunk.mime_type}`);
              } catch (error) {
                this.logger.error(`Error sending audio to Gemini: ${error.message}`);
              }
            }
          } else if (chunk.mime_type.startsWith('image/')) {
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
    if (!sessionData) {
      client.emit('error', { message: 'Session not found' });
      return;
    }

    // Create session on-demand if not exists and not already creating
    if (!sessionData.geminiSession && !sessionData.isCreatingSession) {
      await this.createSessionOnDemand(client, sessionData);
      if (!sessionData.geminiSession) {
        return; // Session creation failed
      }
    } else if (sessionData.isCreatingSession) {
      // Session is being created, queue this request or drop it
      this.logger.debug(`Session creation in progress for client: ${client.id}, dropping request`);
      return;
    }

    try {
      const textContent = data.text;
      sessionData.currentConversation.push({
        role: 'user',
        content: textContent,
      });

      // Send text message to Gemini Live API (from documentation format)
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

      // Handle interruption messages (from VAD)
      if (message.serverContent && message.serverContent.interrupted) {
        this.logger.log(`Generation was interrupted at ${new Date().toISOString()}`);
        
        // Stop any ongoing audio playback
        this.handleInterruption(client, sessionData);
        
        // Notify frontend about interruption
        client.emit('interrupted', { 
          timestamp: new Date().toISOString(),
          message: 'Response interrupted by user input'
        });
        
        // Clear audio queue and reset state
        sessionData.audioResponseQueue = [];
        sessionData.isProcessingAudioResponse = false;
        
        return;
      }

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
        const { modelTurn, turnComplete, inputTranscription, outputTranscription } = message.serverContent;
        
        // Handle input transcription (user speech)
        if (inputTranscription) {
          client.emit('transcription', {
            text: inputTranscription.text,
            sender: 'user',
            finished: inputTranscription.finished || false
          });
        }

        // Handle output transcription (assistant speech)
        if (outputTranscription) {
          client.emit('transcription', {
            text: outputTranscription.text,
            sender: 'assistant',
            finished: outputTranscription.finished || false
          });
        }
        
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

  private handleInterruption(client: Socket, sessionData: SessionData) {
    try {
      // Stop any ongoing audio processing
      sessionData.isProcessingAudioResponse = false;
      
      // Clear audio buffers
      sessionData.audioResponseQueue = [];
      sessionData.assistantAudioBuffer = Buffer.alloc(0);
      
      // Reset audio state
      sessionData.hasAssistantAudio = false;
      
      this.logger.log('Handled interruption - cleared audio state');
    } catch (error) {
      this.logger.error(`Error handling interruption: ${error.message}`);
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
      this.logger.log(`Received tool call: ${JSON.stringify(toolCall, null, 2)}`);
      
      // Google Search and Code Execution are handled automatically by Gemini
      // We only need to handle custom function calls
      const result = await this.geminiService.handleFunctionCall(toolCall, sessionData.userId);
      
      if (result && sessionData.geminiSession && sessionData.geminiSession.sendToolResponse) {
        this.logger.log(`Sending tool response: ${JSON.stringify(result, null, 2)}`);
        sessionData.geminiSession.sendToolResponse({
          functionResponses: [result]
        });
      } else {
        this.logger.log('No custom tool response needed - Google Search/Code Execution handled automatically');
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
      
      // Don't send any welcome message - let the tour agent handle the initial greeting
      // based on location context that will be passed as system message
      this.logger.log('Session ready for user input');
      
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
      
      // Use async memory addition for better performance (non-blocking)
      this.memoryService.addToMemoryAsync(messages, sessionData.userId);
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

  // Helper method to create Gemini session on-demand
  private async createSessionOnDemand(client: Socket, sessionData: SessionData): Promise<void> {
    // Set flag to prevent duplicate creation
    sessionData.isCreatingSession = true;
    
    try {
      // Double-check session doesn't exist (race condition protection)
      if (sessionData.geminiSession) {
        this.logger.debug(`Session already exists for client: ${client.id}, aborting creation`);
        return;
      }

      // Check if we've reached the connection limit
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
        locationContext: sessionData.location, // Include location if available
        language: sessionData.language || 'en-US' // Use stored language or default
      };
      
      const messageHandler = (data: any) => {
        try {
          this.handleGeminiMessage(client, sessionData, data);
        } catch (error) {
          this.logger.error(`Error in message handler: ${error.message}`);
          client.emit('error', { message: 'Failed to process response' });
        }
      };

      // Increment counter before creating session
      this.activeGeminiSessions++;
      this.logger.log(`🚀 Creating Gemini session on-demand ${this.activeGeminiSessions}/${this.MAX_CONCURRENT_CONNECTIONS} for client: ${client.id}`);
      
      sessionData.geminiSession = await this.geminiService.createLiveSession(enhancedConfig, messageHandler);
      
      this.logger.log(`✅ On-demand Gemini session created for client: ${client.id}`);
      client.emit('session_created', { 
        status: 'active',
        message: 'AI session started automatically.'
      });

      this.startGeminiHandlers(client, sessionData);
      
      // Log session status for debugging
      this.logSessionStatus();
    } catch (error) {
      // Decrement counter if session creation failed
      this.activeGeminiSessions--;
      this.logger.error(`Failed to create on-demand Gemini session: ${error.message}`);
      client.emit('error', { message: 'Failed to start AI session automatically' });
    } finally {
      // Always clear the flag when done
      sessionData.isCreatingSession = false;
    }
  }
}