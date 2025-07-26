
import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    useRef,
    useCallback,
  } from "react";
  import { Base64 } from 'js-base64';
  import { io, Socket } from 'socket.io-client';
  
  interface TranscriptionMessage {
    text: string;
    sender: "User" | "Gemini";
    finished: boolean | null;
  }

  interface WebSocketContextType {
    sendMessage: (message: { text?: string; [key: string]: unknown }) => void;
    sendMediaChunk: (chunk: MediaChunk) => void;
    startInteraction: (locationData?: any, languageCode?: string) => void;
    stopInteraction: () => void;
    getSessionStatus: () => void;
    lastTranscription: TranscriptionMessage | null;
    lastAudioData: string | null;
    isConnected: boolean;
    playbackAudioLevel: number;
  }
  
  interface MediaChunk {
    mime_type: string;
    data: string;
  }
  
  interface AudioChunkBuffer {
    data: ArrayBuffer[];
    startTimestamp: number;
  }
  
  const WebSocketContext = createContext<WebSocketContextType | null>(null);
  
  const RECONNECT_TIMEOUT = 5000; // 5 seconds
  const CONNECTION_TIMEOUT = 30000; // 30 seconds
  const AUDIO_BUFFER_DURATION = 2000; // 2 seconds in milliseconds
  const LOOPBACK_DELAY = 3000; // 3 seconds delay matching backend
  
  export const WebSocketProvider: React.FC<{ children: React.ReactNode; url: string; userId?: string }> = ({
    children,
    url,
    userId,
  }: { children: React.ReactNode; url: string; userId?: string }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [playbackAudioLevel, setPlaybackAudioLevel] = useState(0);
    const [lastTranscription, setLastTranscription] = useState<TranscriptionMessage | null>(null);
    const [lastAudioData, setLastAudioData] = useState<string | null>(null);
    const socketRef = useRef<Socket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
    const connectionTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioBufferQueueRef = useRef<AudioChunkBuffer[]>([]);
    const currentChunkRef = useRef<AudioChunkBuffer | null>(null);
    const playbackIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
    const reconnectAttemptsRef = useRef(0);
    const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  
    // Initialize audio context for playback
    const initAudioContext = useCallback(() => {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({
          sampleRate: 24000, // Match the server's 24kHz sample rate
        });
      }
      return audioContextRef.current;
    }, []);
  
    const connect = () => {
      // Don't reconnect if already connecting or connected
      if (socketRef.current && socketRef.current.connected) {
        console.log("Socket already connected, skipping reconnect");
        return;
      }
  
      try {
        const socket = io(url, {
          transports: ['websocket'],
          timeout: CONNECTION_TIMEOUT,
        });
        socketRef.current = socket;
  
        socket.on('connect', () => {
          setIsConnected(true);
          console.log("Socket connected, sending initial setup with user ID:", userId);
          
          // Send initial setup message with user ID
          socket.emit('setup', {
            setup: {
              userId: userId || null
              // Add any needed config options
            }
          });
        });
  
        socket.on('disconnect', () => {
          setIsConnected(false);
          reconnect();
        });
  
        socket.on('error', (error) => {
          console.error('Socket error:', error);
        });

        socket.on('text', (data) => {
          if (data.text) {
            setLastTranscription({
              text: data.text,
              sender: 'Gemini',
              finished: true
            });
          }
        });

        socket.on('transcription', (data) => {
          if (data) {
            setLastTranscription({
              text: data.text,
              sender: data.sender,
              finished: data.finished
            });
          }
        });
  
        socket.on('audio', (data) => {
          if (data.audio) {
            setLastAudioData(data.audio);
            const audioBuffer = Base64.toUint8Array(data.audio);
            
            const now = Date.now();
            const newChunk: AudioChunkBuffer = {
              data: [audioBuffer.buffer as ArrayBuffer],
              startTimestamp: now
            };
            
            audioBufferQueueRef.current.push(newChunk);
          }
        });

        socket.on('interrupted', () => {
          console.log('Received interruption signal, stopping audio playback');
          
          if (currentAudioSourceRef.current) {
            currentAudioSourceRef.current.stop();
            currentAudioSourceRef.current = null;
          }
          audioBufferQueueRef.current = [];
          setPlaybackAudioLevel(0);
        });

        // Handle new session events
        socket.on('setup_complete', (data) => {
          console.log('Setup complete:', data);
        });

        socket.on('interaction_started', (data) => {
          console.log('AI interaction started:', data);
        });

        socket.on('interaction_stopped', (data) => {
          console.log('AI interaction stopped:', data);
        });

        socket.on('session_created', (data) => {
          console.log('AI session created automatically:', data);
        });

        socket.on('session_status', (data) => {
          console.log('📊 Session Status:', data);
          if (!data.counterAccurate) {
            console.warn('⚠️ Session counter mismatch detected!', data);
          }
        });
  
      } catch (error) {
        console.error('Socket connection error:', error);
        reconnect();
      }
    };
  
    const sendBinary = (data: ArrayBuffer) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('binary', data);
      }
    };
  
    // Fix the audio playback approach
    useEffect(() => {
      let isPlaybackActive = false;
      
      // Function to play the next chunk when available
      const playNextWhenReady = async () => {
        if (isPlaybackActive || audioBufferQueueRef.current.length === 0) {
          return;
        }
        
        isPlaybackActive = true;
        
        try {
          // Get all available chunks for a single playback
          const allChunks = [...audioBufferQueueRef.current];
          audioBufferQueueRef.current = [];
          
          // Combine all buffers from all chunks
          const allBuffers: ArrayBuffer[] = [];
          allChunks.forEach(chunk => {
            allBuffers.push(...chunk.data);
          });
          
          // Play the combined audio
          await playAudioChunk(allBuffers);
          
          // Check if more chunks arrived during playback
          if (audioBufferQueueRef.current.length > 0) {
            // Continue playing without delay
            playNextWhenReady();
          }
        } catch (error) {
          console.error("Error in audio playback:", error);
        } finally {
          isPlaybackActive = false;
        }
      };
      
      // Set up a polling mechanism instead of overriding push
      const checkInterval = setInterval(() => {
        if (audioBufferQueueRef.current.length > 0 && !isPlaybackActive) {
          playNextWhenReady();
        }
      }, 50);
      
      // Also check when new audio data is received
      const originalPush = Array.prototype.push;
      audioBufferQueueRef.current.push = function(...items) {
        const result = originalPush.apply(this, items);
        setTimeout(playNextWhenReady, 0);
        return result;
      };
      
      return () => {
        clearInterval(checkInterval);
        // Restore original push method
        if (audioBufferQueueRef.current) {
          audioBufferQueueRef.current.push = originalPush;
        }
      };
    }, []);
  
    // New function to play concatenated audio chunks
    const playAudioChunk = useCallback((audioBuffers: ArrayBuffer[]): Promise<void> => {
      return new Promise((resolve, reject) => {
        try {
          const ctx = initAudioContext();
          
          const totalLength = audioBuffers.reduce((acc, buffer) => 
            acc + new Int16Array(buffer).length, 0);
          
          if (totalLength === 0) {
            return resolve();
          }
          
          const combinedInt16Array = new Int16Array(totalLength);
          let offset = 0;
          
          audioBuffers.forEach(buffer => {
            const int16Data = new Int16Array(buffer);
            combinedInt16Array.set(int16Data, offset);
            offset += int16Data.length;
          });
          
          const audioBuffer = ctx.createBuffer(1, totalLength, 24000);
          const channelData = audioBuffer.getChannelData(0);
          
          // Improved smoothing
          for (let i = 0; i < totalLength; i++) {
            channelData[i] = combinedInt16Array[i] / 32768.0;
          }
          
          // Longer fade for smoother transitions
          const fadeSamples = Math.min(200, totalLength / 8);
          
          // Fade in
          for (let i = 0; i < fadeSamples; i++) {
            const factor = Math.sin((i / fadeSamples) * Math.PI / 2); // Smoother sine curve
            channelData[i] *= factor;
          }
          
          // Fade out
          for (let i = 0; i < fadeSamples; i++) {
            const factor = Math.sin((i / fadeSamples) * Math.PI / 2);
            channelData[totalLength - 1 - i] *= factor;
          }
          
          const source = ctx.createBufferSource();
          currentAudioSourceRef.current = source; // Store the current source
          const gainNode = ctx.createGain();
          gainNode.gain.value = 1.5;
          
          source.buffer = audioBuffer;
          source.connect(gainNode);
          gainNode.connect(ctx.destination);
          
          const durationMs = (audioBuffer.length / audioBuffer.sampleRate) * 1000;
          
          source.start();
          
          // Simple random movement simulation for playback level indicator
          const simulateLevel = () => {
            // Generate random number between 20-40 to simulate gentle movement
            const randomLevel = 20 + Math.floor(Math.random() * 20);
            setPlaybackAudioLevel(randomLevel);
          };
          
          // Update level every 200ms while audio is playing
          const levelInterval = setInterval(simulateLevel, 200);
          
          // Clean up interval and reset level when audio finishes
          setTimeout(() => {
            clearInterval(levelInterval);
            setPlaybackAudioLevel(0); // Reset to zero after playback
            currentAudioSourceRef.current = null; // Clear the current source
            resolve();
          }, durationMs);
          
          source.onended = () => {
            clearInterval(levelInterval);
            setPlaybackAudioLevel(0); // Also reset to zero if source ends early
            currentAudioSourceRef.current = null; // Clear the current source
            resolve();
          };
          
        } catch (error) {
          console.error('Error playing audio:', error);
          reject(error);
        }
      });
    }, [initAudioContext]);
  
    const reconnect = () => {
      // Only schedule reconnect if not already scheduled
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      // Use exponential backoff for reconnection attempts
      const backoffTime = Math.min(30000, RECONNECT_TIMEOUT * (reconnectAttemptsRef.current || 1));
      console.log(`Scheduling reconnect in ${backoffTime}ms`);
      
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectAttemptsRef.current = (reconnectAttemptsRef.current || 0) + 1;
        connect();
      }, backoffTime);
    };
  
    useEffect(() => {
      connect();
      return () => {
        if (socketRef.current) {
          socketRef.current.disconnect();
        }
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
        }
      };
    }, [url, playAudioChunk]);
  
    useEffect(() => {
      if (isConnected) {
        reconnectAttemptsRef.current = 0;
      }
    }, [isConnected]);
  
    const sendMessage = (message: { text?: string; [key: string]: unknown }) => {
      if (socketRef.current?.connected) {
        if (message.text) {
          socketRef.current.emit('text', { text: message.text });
        } else {
          socketRef.current.emit('message', message);
        }
      }
    };
  
    const sendMediaChunk = (chunk: MediaChunk) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('realtime_input', {
          realtime_input: {
            media_chunks: [chunk]
          }
        });
      }
    };

    const startInteraction = (locationData?: any, languageCode?: string) => {
      if (socketRef.current?.connected) {
        console.log('🚀 WebSocketProvider - Starting AI interaction');
        console.log('📍 WebSocketProvider - Location data received:', locationData);
        console.log('🗣️ WebSocketProvider - Language code:', languageCode);
        
        const payload = {
          location: locationData,
          language: languageCode || 'en-US'
        };
        
        console.log('📦 WebSocketProvider - SENDING TO BACKEND:', JSON.stringify(payload, null, 2));
        
        socketRef.current.emit('start_interaction', payload);
      } else {
        console.error('❌ WebSocketProvider - Socket not connected, cannot start interaction');
      }
    };

    const stopInteraction = () => {
      if (socketRef.current?.connected) {
        console.log('Stopping AI interaction...');
        socketRef.current.emit('stop_interaction', {});
      }
    };

    const getSessionStatus = () => {
      if (socketRef.current?.connected) {
        console.log('Requesting session status...');
        socketRef.current.emit('get_session_status', {});
      }
    };
  
    return (
      <WebSocketContext.Provider 
        value={{ 
          sendMessage,
          sendMediaChunk,
          startInteraction,
          stopInteraction,
          getSessionStatus,
          lastTranscription,
          lastAudioData,
          isConnected,
          playbackAudioLevel
        }}
      >
        {children}
      </WebSocketContext.Provider>
    );
  };
  
  export const useWebSocket = () => {
    const context = useContext(WebSocketContext);
    if (!context) {
      throw new Error("useWebSocket must be used within a WebSocketProvider");
    }
    return context;
  };
