import React, { useRef, useState, useEffect } from "react";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";
import { useWebSocket } from "./WebSocketProvider";
import { Base64 } from 'js-base64';

interface ChatMessage {
  text: string;
  sender: "User" | "Gemini";
  timestamp: string;
  isComplete: boolean;
}

interface AudioShareProps {
  locationData?: any;
  isLocationReady?: boolean;
  locationError?: string | null;
}

const AudioShare: React.FC<AudioShareProps> = ({ 
  locationData, 
  isLocationReady = false, 
  locationError = null 
}) => {
  console.log('🎬 AudioShare component is rendering...');
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [detailedLocationData, setDetailedLocationData] = useState<any>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([{
    text: "Audio sharing session started. I'll transcribe what I hear.",
    sender: "Gemini",
    timestamp: new Date().toLocaleTimeString(),
    isComplete: true
  }]);

  const { sendMessage, sendMediaChunk, startInteraction, stopInteraction, isConnected, playbackAudioLevel, lastTranscription } = useWebSocket();

  // Store detailed location data when received
  useEffect(() => {
    if (locationData) {
      setDetailedLocationData(locationData);
      console.log('💾 Stored detailed location data locally:', locationData);
    }
  }, [locationData]);

  // Log received props for debugging
  useEffect(() => {
    console.log('🎬 AudioRecorder received props:', {
      hasLocationData: !!locationData,
      isLocationReady,
      locationError,
      basicLocation: locationData ? { country: locationData.country, state: locationData.state } : null
    });
  }, [locationData, isLocationReady, locationError]);

  // Handle incoming transcriptions
  useEffect(() => {
    if (lastTranscription) {
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1];
        const shouldUpdateLast = lastMessage &&
          lastMessage.sender === lastTranscription.sender &&
          !lastMessage.isComplete;

        if (shouldUpdateLast) {
          const updatedMessages = [...prev];
          updatedMessages[updatedMessages.length - 1] = {
            ...lastMessage,
            text: lastMessage.text + lastTranscription.text,
            isComplete: lastTranscription.finished === true
          };
          return updatedMessages;
        }

        const newMessage = {
          text: lastTranscription.text,
          sender: lastTranscription.sender,
          timestamp: new Date().toLocaleTimeString(),
          isComplete: lastTranscription.finished === true
        };
        return [...prev, newMessage];
      });
    }
  }, [lastTranscription]);

  const startSharing = async () => {
    if (isSharing) return;

    try {
      // Get audio stream
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 16000
        }
      });

      // Set up audio context and processing
      audioContextRef.current = new AudioContext({
        sampleRate: 16000,
        latencyHint: 'interactive'
      });

      const ctx = audioContextRef.current;
      await ctx.audioWorklet.addModule('/worklets/audio-processor.js');
      const source = ctx.createMediaStreamSource(audioStream);

      audioWorkletNodeRef.current = new AudioWorkletNode(ctx, 'audio-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        processorOptions: {
          sampleRate: 16000,
          bufferSize: 4096,
        },
        channelCount: 1,
        channelCountMode: 'explicit',
        channelInterpretation: 'speakers'
      });

      // Set up audio processing
      audioWorkletNodeRef.current.port.onmessage = (event) => {
        const { pcmData, level } = event.data;
        setAudioLevel(level);

        if (pcmData) {
          const base64Data = Base64.fromUint8Array(new Uint8Array(pcmData));
          sendMediaChunk({
            mime_type: "audio/pcm",
            data: base64Data
          });
        }
      };

      source.connect(audioWorkletNodeRef.current);
      audioStreamRef.current = audioStream;

      // Extract only basic location data - let AI ask for more details when needed
      console.log('✅ Extracting basic location from parent component data...');
      const basicLocation = locationData ? {
        country: locationData.country,
        state: locationData.state
      } : null;
      
      console.log('📋 Basic location for AI:', basicLocation);
      console.log('💾 Storing detailed location data locally for AI requests');

      // Start the AI interaction session with basic location context
      console.log('🚀 Starting AI interaction with basic location context...');
      startInteraction(basicLocation);

      setIsSharing(true);
    } catch (err) {
      console.error('Failed to start audio sharing:', err);
      stopSharing();
    }
  };

  const stopSharing = () => {
    // Stop the AI interaction session when user stops recording
    stopInteraction();

    // Stop audio stream
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }

    // Clean up audio processing
    if (audioWorkletNodeRef.current) {
      audioWorkletNodeRef.current.disconnect();
      audioWorkletNodeRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setIsSharing(false);
    setAudioLevel(0);
  };

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-3xl">
      {/* Welcome Header */}
      <div className="text-center space-y-2">
        <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
          Gemini Audio Learning Assistant
        </h1>
        <p className="text-xl text-muted-foreground">
          Share your audio and talk to me
        </p>
      </div>

      {/* Audio Controls */}
      <Card className="w-full md:w-[640px] mx-auto">
        <CardContent className="p-6">
          <div className="flex flex-col items-center space-y-4">
            {/* Audio Level Indicator */}
            {isSharing && (
              <div className="w-full space-y-2">
                <Progress
                  value={Math.max(audioLevel, playbackAudioLevel)}
                  className="h-1 bg-white"
                  indicatorClassName="bg-black"
                />
              </div>
            )}

            {!isSharing ? (
              <div className="flex flex-col items-center space-y-2">
                <Button
                  size="lg"
                  onClick={startSharing}
                  disabled={!isConnected}
                  variant={isConnected ? "default" : "outline"}
                  className={!isConnected ? "border-red-300 text-red-700" : ""}
                >
                  {!isConnected 
                    ? "Connecting to server..."
                    : "Start Audio Share"
                  }
                </Button>
                {locationError && (
                  <p className="text-sm text-yellow-600">
                    ⚠️ {locationError}
                  </p>
                )}
                {isLocationReady && (
                  <p className="text-sm text-green-600">
                    ✅ Location ready
                  </p>
                )}
              </div>
            ) : (
              <Button size="lg" variant="destructive" onClick={stopSharing}>
                Stop Sharing
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Chat History */}
      <Card className="w-full md:w-[640px] mx-auto">
        <CardHeader>
          <CardTitle>Chat History</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className="flex items-start space-x-4 rounded-lg p-4 bg-muted/50"
                >
                  <div className="h-8 w-8 rounded-full flex items-center justify-center bg-primary">
                    <span className="text-xs font-medium text-primary-foreground">
                      {message.sender === "Gemini" ? "AI" : "You"}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm leading-loose">{message.text}</p>
                    <p className="text-xs text-muted-foreground">
                      {message.timestamp}
                      {!message.isComplete && " (typing...)"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default AudioShare;