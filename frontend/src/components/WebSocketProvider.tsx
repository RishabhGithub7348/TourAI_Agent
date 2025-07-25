'use client'

import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import io, { Socket } from 'socket.io-client'

interface WebSocketContextType {
  socket: Socket | null
  isConnected: boolean
  sendMediaChunk: (audioData: string, mimeType: string) => void
  sendTextMessage: (text: string) => void
  audioLevel: number
  isProcessing: boolean
}

const WebSocketContext = createContext<WebSocketContextType | null>(null)

interface WebSocketProviderProps {
  children: React.ReactNode
  serverUrl: string
  userId?: string
  location?: string
  onTextMessage?: (text: string) => void
  onAudioMessage?: (audioData: string) => void
  onError?: (error: string) => void
}

export function WebSocketProvider({
  children,
  serverUrl,
  userId,
  location,
  onTextMessage,
  onAudioMessage,
  onError
}: WebSocketProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Audio processing similar to reference implementation
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioQueueRef = useRef<{ data: string; timestamp: number }[]>([])
  const isPlayingRef = useRef(false)

  useEffect(() => {
    if (!userId) return

    const newSocket = io(serverUrl, {
      transports: ['websocket'],
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    newSocket.on('connect', () => {
      console.log('Connected to voice backend')
      setIsConnected(true)
      
      // Send setup configuration
      newSocket.emit('setup', {
        setup: {
          user_id: userId,
          session_type: 'voice_chat',
          location: location || undefined
        }
      })
    })

    newSocket.on('disconnect', () => {
      console.log('Disconnected from voice backend')
      setIsConnected(false)
      setIsProcessing(false)
    })

    newSocket.on('connect_error', (error) => {
      console.error('Connection error:', error)
      onError?.(`Connection error: ${error.message}`)
    })

    newSocket.on('text', (data) => {
      console.log('Received text:', data.text)
      onTextMessage?.(data.text)
      setIsProcessing(false)
    })

    newSocket.on('audio', (data) => {
      console.log('Received audio data, length:', data.audio?.length || 0)
      if (data.audio) {
        queueAudioForPlayback(data.audio)
        onAudioMessage?.(data.audio)
      }
      setIsProcessing(false)
    })

    newSocket.on('setup_complete', (data) => {
      console.log('Setup complete:', data)
    })

    newSocket.on('error', (error) => {
      console.error('Socket error:', error)
      onError?.(error.message || 'Socket error')
      setIsProcessing(false)
    })

    setSocket(newSocket)

    return () => {
      newSocket.close()
    }
  }, [serverUrl, userId, location])

  // Audio playback queue management (similar to reference)
  const queueAudioForPlayback = (base64Audio: string) => {
    audioQueueRef.current.push({
      data: base64Audio,
      timestamp: Date.now()
    })

    if (!isPlayingRef.current) {
      processAudioQueue()
    }
  }

  const processAudioQueue = async () => {
    if (audioQueueRef.current.length === 0 || isPlayingRef.current) {
      return
    }

    isPlayingRef.current = true

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }

      while (audioQueueRef.current.length > 0) {
        const audioItem = audioQueueRef.current.shift()
        if (audioItem) {
          await playAudioData(audioItem.data)
          
          // Add small gap between audio chunks
          await new Promise(resolve => setTimeout(resolve, 50))
        }
      }
    } catch (error) {
      console.error('Error processing audio queue:', error)
    } finally {
      isPlayingRef.current = false
    }
  }

  const playAudioData = async (base64Audio: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        if (!audioContextRef.current) {
          throw new Error('No audio context available')
        }

        // Convert base64 to ArrayBuffer
        const binaryString = atob(base64Audio)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        
        audioContextRef.current.decodeAudioData(
          bytes.buffer.slice(0),
          (audioBuffer) => {
            const source = audioContextRef.current!.createBufferSource()
            source.buffer = audioBuffer
            source.connect(audioContextRef.current!.destination)
            
            source.onended = () => resolve()
            source.start()
          },
          (error) => {
            console.error('Error decoding audio:', error)
            reject(error)
          }
        )
      } catch (error) {
        console.error('Error playing audio:', error)
        reject(error)
      }
    })
  }

  const sendMediaChunk = (audioData: string, mimeType: string = 'audio/pcm') => {
    if (!socket || !isConnected) {
      console.warn('Cannot send audio: not connected')
      return
    }

    setIsProcessing(true)
    
    socket.emit('realtime_input', {
      realtime_input: {
        media_chunks: [{
          mime_type: mimeType,
          data: audioData
        }]
      }
    })

    console.log('Sent audio chunk:', { mimeType, dataLength: audioData.length })
  }

  const sendTextMessage = (text: string) => {
    if (!socket || !isConnected) {
      console.warn('Cannot send text: not connected')
      return
    }

    setIsProcessing(true)
    socket.emit('text', { text })
    console.log('Sent text message:', text)
  }

  // Simulate audio level for UI (similar to reference)
  useEffect(() => {
    let animationFrame: number

    const updateAudioLevel = () => {
      if (isProcessing) {
        setAudioLevel(Math.random() * 0.5 + 0.3) // Simulate activity
        animationFrame = requestAnimationFrame(updateAudioLevel)
      } else {
        setAudioLevel(0)
      }
    }

    if (isProcessing) {
      updateAudioLevel()
    }

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame)
      }
    }
  }, [isProcessing])

  const contextValue: WebSocketContextType = {
    socket,
    isConnected,
    sendMediaChunk,
    sendTextMessage,
    audioLevel,
    isProcessing
  }

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  )
}

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider')
  }
  return context
}