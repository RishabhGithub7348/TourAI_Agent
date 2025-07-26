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
  selectedLanguage?: string;
  onAudioLevelChange?: (level: number) => void;
  onSpeakingStateChange?: (isSpeaking: boolean) => void;
}

const AudioShare: React.FC<AudioShareProps> = ({ 
  locationData, 
  isLocationReady = false, 
  locationError = null,
  selectedLanguage = 'en-US',
  onAudioLevelChange,
  onSpeakingStateChange
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
    console.log('🎬 AudioRecorder - Props received from parent component:');
    console.log('   📍 hasLocationData:', !!locationData);
    console.log('   ✅ isLocationReady:', isLocationReady);
    console.log('   ❌ locationError:', locationError);
    console.log('   📊 Full locationData object:', locationData);
    console.log('   📋 Extracted basic location:', locationData ? { 
      city: locationData.city, 
      state: locationData.state, 
      country: locationData.country 
    } : null);
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

      // Notify parent of speaking state changes
      if (onSpeakingStateChange && lastTranscription.sender === 'User') {
        onSpeakingStateChange(!lastTranscription.finished);
      }
    }
  }, [lastTranscription, onSpeakingStateChange]);

  // Track audio levels for parent component
  useEffect(() => {
    if (onAudioLevelChange) {
      onAudioLevelChange(audioLevel);
    }
  }, [audioLevel, onAudioLevelChange]);

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

      // Extract basic location data including city - let AI ask for more details when needed
      console.log('✅ AudioRecorder - Extracting basic location from parent component data...');
      console.log('📊 AudioRecorder - Raw locationData received from parent:', locationData);
      
      const basicLocation = locationData ? {
        city: locationData.city,
        state: locationData.state,
        country: locationData.country
      } : null;
      
      console.log('📋 AudioRecorder - Basic location extracted for AI:', basicLocation);
      console.log('🔍 AudioRecorder - Location data breakdown:');
      console.log('   🏙️ City:', locationData?.city || 'NOT PROVIDED');
      console.log('   🏛️ State:', locationData?.state || 'NOT PROVIDED');
      console.log('   🌍 Country:', locationData?.country || 'NOT PROVIDED');
      console.log('🌐 AudioRecorder - Selected language:', selectedLanguage);
      console.log('💾 AudioRecorder - Storing detailed location data locally for AI requests');

      // Start the AI interaction session with basic location context and language
      console.log('🚀 AudioRecorder - Calling startInteraction with:', {
        basicLocation,
        selectedLanguage
      });
      startInteraction(basicLocation, selectedLanguage);

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
    <div className="flex flex-col items-center justify-center space-y-8">
      {/* Status Message */}
      <div className="text-center">
        <p className="text-white/80 text-lg">
          {isSharing ? "Listening..." : "Ready to chat"}
        </p>
      </div>

      {/* Audio Controls */}
      <div className="flex items-center space-x-6">
        {!isSharing ? (
          <button
            onClick={startSharing}
            disabled={!isConnected}
            className={`
              w-16 h-16 rounded-full flex items-center justify-center 
              transition-all duration-300 transform hover:scale-110
              ${isConnected 
                ? 'bg-white/20 hover:bg-white/30 text-white' 
                : 'bg-red-500/20 text-red-400 cursor-not-allowed'
              }
            `}
          >
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
            </svg>
          </button>
        ) : (
          <button
            onClick={stopSharing}
            className="w-16 h-16 rounded-full flex items-center justify-center bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-all duration-300 transform hover:scale-110"
          >
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h12v12H6z"/>
            </svg>
          </button>
        )}
      </div>

      {/* Connection Status */}
      {!isConnected && (
        <p className="text-red-400 text-sm">
          Connecting to server...
        </p>
      )}
      
      {/* Location Status */}
      {locationError && (
        <p className="text-yellow-400 text-sm">
          ⚠️ {locationError}
        </p>
      )}
    </div>
  );
};

export default AudioShare;