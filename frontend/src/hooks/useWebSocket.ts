'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import io, { Socket } from 'socket.io-client'

interface UseWebSocketProps {
  url: string
  userId?: string
  location?: string
  onConnect?: () => void
  onDisconnect?: () => void
  onMessage?: (data: unknown) => void
  onError?: (error: unknown) => void
}

export const useWebSocket = ({
  url,
  userId,
  location,
  onConnect,
  onDisconnect,
  onMessage,
  onError
}: UseWebSocketProps) => {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connectionAttempts, setConnectionAttempts] = useState(0)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Stable references for callbacks to prevent infinite loops
  const onConnectRef = useRef(onConnect)
  const onDisconnectRef = useRef(onDisconnect)
  const onMessageRef = useRef(onMessage)
  const onErrorRef = useRef(onError)

  const MAX_RECONNECT_ATTEMPTS = 5
  const RECONNECT_DELAY = 3000

  // Update callback refs when they change
  useEffect(() => {
    onConnectRef.current = onConnect
    onDisconnectRef.current = onDisconnect
    onMessageRef.current = onMessage
    onErrorRef.current = onError
  }, [onConnect, onDisconnect, onMessage, onError])

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }, [])

  const connectSocket = useCallback(() => {
    if (!userId) return

    const newSocket = io(url, {
      transports: ['websocket'],
      timeout: 10000,
      reconnection: false, // Handle reconnection manually
    })

    newSocket.on('connect', () => {
      console.log('Connected to backend')
      setIsConnected(true)
      setError(null)
      setConnectionAttempts(0)
      onConnectRef.current?.()
      
      // Send setup configuration
      newSocket.emit('setup', {
        setup: {
          user_id: userId,
          session_type: 'voice_chat',
          location: location || undefined
        }
      })
    })

    newSocket.on('disconnect', (reason) => {
      console.log('Disconnected from backend:', reason)
      setIsConnected(false)
      onDisconnectRef.current?.()
      
      // Auto-reconnect on unexpected disconnections
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, don't reconnect
        setError('Server disconnected')
      } else {
        setConnectionAttempts(prev => {
          const newAttempts = prev + 1
          if (newAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectTimeoutRef.current = setTimeout(() => {
              console.log(`Reconnection attempt ${newAttempts}`)
              connectSocket()
            }, RECONNECT_DELAY)
          } else {
            setError('Max reconnection attempts reached')
          }
          return newAttempts
        })
      }
    })

    newSocket.on('connect_error', (err) => {
      console.error('Connection error:', err)
      setError(`Connection error: ${err.message}`)
      onErrorRef.current?.(err)
    })

    newSocket.on('text', (data) => {
      onMessageRef.current?.({ type: 'text', ...data })
    })

    newSocket.on('audio', (data) => {
      console.log('Received audio data from backend:', {
        hasAudio: !!data.audio,
        audioLength: data.audio?.length || 0
      })
      onMessageRef.current?.({ type: 'audio', ...data })
    })

    newSocket.on('setup_complete', (data) => {
      console.log('Setup complete:', data)
      onMessageRef.current?.({ type: 'setup_complete', ...data })
    })

    newSocket.on('error', (err) => {
      console.error('Socket error:', err)
      setError(err.message || 'Socket error')
      onErrorRef.current?.(err)
    })

    setSocket(newSocket)
    return newSocket
  }, [url, userId, location]) // Include location for setup updates

  useEffect(() => {
    const newSocket = connectSocket()
    
    return () => {
      cleanup()
      if (newSocket) {
        newSocket.close()
      }
    }
  }, [connectSocket, cleanup])

  const sendMessage = useCallback((eventName: string, data: unknown) => {
    if (socket && isConnected) {
      socket.emit(eventName, data)
    }
  }, [socket, isConnected])

  const sendAudio = useCallback((audioData: string, mimeType: string = 'audio/webm') => {
    console.log('Sending audio data:', {
      dataLength: audioData.length,
      mimeType,
      preview: audioData.substring(0, 50) + '...'
    })
    
    sendMessage('realtime_input', {
      realtime_input: {
        media_chunks: [{
          mime_type: mimeType,
          data: audioData
        }]
      }
    })
    
    console.log('Audio data sent via WebSocket')
  }, [sendMessage])

  const sendText = useCallback((text: string) => {
    sendMessage('text', { text })
  }, [sendMessage])

  const reconnect = useCallback(() => {
    if (socket) {
      socket.close()
    }
    setConnectionAttempts(0)
    setError(null)
    connectSocket()
  }, [socket, connectSocket])

  return {
    socket,
    isConnected,
    error,
    connectionAttempts,
    sendMessage,
    sendAudio,
    sendText,
    reconnect
  }
}