'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Mic, MicOff, Square } from 'lucide-react'
import { useWebSocketContext } from './WebSocketProvider'

interface AudioRecorderProps {
  onRecordingStart?: () => void
  onRecordingStop?: () => void
  onAudioData?: (audioData: string) => void
}

export function AudioRecorder({
  onRecordingStart,
  onRecordingStop,
  onAudioData
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const { sendMediaChunk, isConnected, isProcessing } = useWebSocketContext()
  
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | undefined>(undefined)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)

  // Helper functions for audio processing (defined first to avoid circular dependency)
  const float32ToInt16 = useCallback((float32Array: Float32Array): Int16Array => {
    const int16Array = new Int16Array(float32Array.length)
    
    for (let i = 0; i < float32Array.length; i++) {
      const clampedValue = Math.max(-1, Math.min(1, float32Array[i]))
      int16Array[i] = clampedValue * 0x7FFF
    }
    
    return int16Array
  }, [])

  const arrayBufferToBase64 = useCallback((buffer: ArrayBufferLike): string => {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }, [])

  // Audio processing using Web Audio API for real-time PCM data
  const startRecording = useCallback(async () => {
    try {
      console.log('Starting audio recording...')
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      })

      streamRef.current = stream

      // Create audio context for processing
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
        latencyHint: 'interactive'
      })

      // Create audio source and analyzer
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream)
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 256
      
      // Create script processor for real-time audio processing
      const bufferSize = 4096 // Process in chunks
      processorRef.current = audioContextRef.current.createScriptProcessor(bufferSize, 1, 1)
      
      processorRef.current.onaudioprocess = (event) => {
        if (!isRecording) return
        
        const inputBuffer = event.inputBuffer
        const channelData = inputBuffer.getChannelData(0) // Mono audio
        
        // Convert float32 to int16 PCM
        const pcmData = float32ToInt16(channelData)
        
        // Convert to base64 and send
        const base64Data = arrayBufferToBase64(pcmData.buffer)
        sendMediaChunk(base64Data, 'audio/pcm')
        onAudioData?.(base64Data)
      }
      
      // Connect the audio graph
      sourceRef.current.connect(analyserRef.current)
      sourceRef.current.connect(processorRef.current)
      processorRef.current.connect(audioContextRef.current.destination)

      // Start visual feedback
      updateAudioLevel()

      setIsRecording(true)
      onRecordingStart?.()
      
      console.log('Recording started successfully')
      
    } catch (error) {
      console.error('Error starting recording:', error)
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          console.error('Microphone access denied')
        } else if (error.name === 'NotFoundError') {
          console.error('No microphone found')
        }
      }
    }
  }, [sendMediaChunk, onRecordingStart, onAudioData, isRecording, float32ToInt16, arrayBufferToBase64])

  const stopRecording = useCallback(() => {
    console.log('Stopping recording...')

    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect()
      sourceRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop()
      })
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    setIsRecording(false)
    setAudioLevel(0)
    onRecordingStop?.()
    
    console.log('Recording stopped')
  }, [isRecording, onRecordingStop])

  // Audio level visualization
  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current || !isRecording) {
      return
    }

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(dataArray)
    
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length
    setAudioLevel(average / 255)

    if (isRecording) {
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel)
    }
  }, [isRecording])

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Direct cleanup without calling callbacks to avoid infinite loops
      if (processorRef.current) {
        processorRef.current.disconnect()
      }

      if (sourceRef.current) {
        sourceRef.current.disconnect()
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop()
        })
      }

      if (audioContextRef.current) {
        audioContextRef.current.close()
      }

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Audio Level Visualizer */}
      {isRecording && (
        <div className="flex items-center space-x-2">
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              className="w-1 bg-blue-400 rounded-full"
              animate={{
                height: [10, Math.max(10, audioLevel * 50 + Math.random() * 20), 10],
              }}
              transition={{
                duration: 0.3,
                repeat: Infinity,
                delay: i * 0.1,
              }}
            />
          ))}
        </div>
      )}

      {/* Recording Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={toggleRecording}
        disabled={!isConnected || isProcessing}
        className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 ${
          isRecording
            ? 'bg-red-500 shadow-lg shadow-red-500/50'
            : 'bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-500/50'
        } ${!isConnected || isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {isRecording ? (
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            <Square className="w-6 h-6 text-white" fill="currentColor" />
          </motion.div>
        ) : (
          <Mic className="w-6 h-6 text-white" />
        )}
      </motion.button>

      {/* Status */}
      <div className="text-center">
        <p className="text-sm text-gray-400">
          {isRecording ? 'Recording...' : 'Click to record'}
        </p>
        {!isConnected && (
          <p className="text-xs text-red-400">Not connected</p>
        )}
        {isProcessing && (
          <p className="text-xs text-yellow-400">Processing...</p>
        )}
      </div>
    </div>
  )
}