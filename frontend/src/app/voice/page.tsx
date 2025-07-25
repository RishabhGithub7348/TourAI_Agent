'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useUser, SignOutButton } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { 
  Send, 
  User, 
  Bot, 
  Home,
  MapPin,
  Bookmark,
  Book,
  LogOut,
  RefreshCw
} from 'lucide-react'
import { useGeolocation } from '@/hooks/useGeolocation'
import { WebSocketProvider, useWebSocketContext } from '@/components/WebSocketProvider'
import { AudioRecorder } from '@/components/AudioRecorder'
import { Bookmarks } from '@/components/voice/Bookmarks'
import { StoryMode } from '@/components/voice/StoryMode'

interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  isAudio?: boolean
}

function VoicePageContent() {
  const [messages, setMessages] = useState<Message[]>([])
  const [textInput, setTextInput] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false)
  const [isStoryModeOpen, setIsStoryModeOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Get WebSocket context
  const { isConnected, isProcessing, sendTextMessage } = useWebSocketContext()
  
  // Geolocation hook
  const { error: locationError, loading: locationLoading, locationString, getCurrentPosition, isSupported } = useGeolocation()

  // Message handlers
  const handleTextMessage = (text: string) => {
    addMessage('assistant', text)
  }

  const handleAudioMessage = (audioData: string) => {
    addMessage('assistant', '🔊 Audio response received', true)
  }

  const handleError = (error: string) => {
    setErrorMessage(error)
    addMessage('assistant', `Error: ${error}`)
  }

  // Clear error message after some time
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [errorMessage])


  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const addMessage = (type: 'user' | 'assistant', content: string, isAudio = false) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date(),
      isAudio
    }
    setMessages(prev => [...prev, newMessage])
  }

  const handleRecordingStart = useCallback(() => {
    addMessage('user', 'Listening...', true)
  }, [])

  const handleRecordingStop = useCallback(() => {
    // Remove the "Listening..." message
    setMessages(prev => prev.filter(msg => msg.content !== 'Listening...'))
    addMessage('user', '🎤 Voice message sent', true)
  }, [])

  const handleAudioData = useCallback((audioData: string) => {
    console.log('Audio data received from recorder:', audioData.length)
  }, [])

  const handleSendText = () => {
    if (!textInput.trim() || !isConnected) return

    sendTextMessage(textInput)
    addMessage('user', textInput)
    setTextInput('')
  }

  const handleStartStory = (storyId: string) => {
    console.log('Starting story:', storyId)
    setIsStoryModeOpen(false)
    // Here you could integrate story mode with your Gemini backend
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex flex-col">
      {/* Error Banner */}
      {errorMessage && (
        <div className="bg-red-500/20 border-b border-red-500/30 px-4 py-2">
          <p className="text-red-400 text-sm text-center">{errorMessage}</p>
        </div>
      )}

      {/* Header */}
      <header className="glass border-b border-white/10 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <h1 className="text-xl font-bold gradient-text">TourGuide AI</h1>
              <div className="flex flex-col space-y-1">
                <div className="flex items-center space-x-2 text-sm text-gray-400">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
                  {isProcessing && (
                    <span className="text-blue-400">Processing...</span>
                  )}
                </div>
                {locationString && (
                  <div className="flex items-center space-x-2 text-xs text-green-400">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate max-w-48">{locationString}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={getCurrentPosition}
              disabled={!isSupported || locationLoading}
              title={locationString || (locationError ? 'Location access failed' : 'Get current location')}
              className={`relative ${locationString ? 'text-green-400' : locationError ? 'text-red-400' : ''}`}
            >
              <MapPin className={`w-5 h-5 ${locationLoading ? 'animate-pulse' : ''}`} />
              {locationString && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />
              )}
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsBookmarksOpen(true)}
              title="Bookmarks"
            >
              <Bookmark className="w-5 h-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsStoryModeOpen(true)}
              title="Story Mode"
            >
              <Book className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-hidden flex flex-col max-w-4xl mx-auto w-full">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex items-start space-x-3 max-w-[80%] ${
                  message.type === 'user' ? 'flex-row-reverse space-x-reverse' : 'flex-row'
                }`}>
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    message.type === 'user' 
                      ? 'bg-blue-500' 
                      : 'bg-gradient-to-r from-purple-500 to-blue-500'
                  }`}>
                    {message.type === 'user' ? (
                      <User className="w-4 h-4 text-white" />
                    ) : (
                      <Bot className="w-4 h-4 text-white" />
                    )}
                  </div>

                  {/* Message */}
                  <div className={`glass rounded-2xl px-4 py-3 ${
                    message.type === 'user'
                      ? 'bg-blue-500/20 border-blue-500/30'
                      : 'bg-white/5 border-white/10'
                  }`}>
                    <p className="text-white whitespace-pre-wrap">
                      {message.content}
                    </p>
                    <span className="text-xs text-gray-400 mt-1 block">
                      {message.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isProcessing && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="glass rounded-2xl px-4 py-3 bg-white/5 border-white/10">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Audio Recorder */}
        <div className="flex justify-center py-4">
          <AudioRecorder
            onRecordingStart={handleRecordingStart}
            onRecordingStop={handleRecordingStop}
            onAudioData={handleAudioData}
          />
        </div>

        {/* Input Area */}
        <div className="glass border-t border-white/10 p-4">
          <div className="flex items-center space-x-4">
            {/* Text Input */}
            <div className="flex-1 relative">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendText()}
                placeholder="Type your message or use voice..."
                className="w-full bg-white/5 border border-white/20 rounded-full px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
              <Button
                onClick={handleSendText}
                disabled={!textInput.trim() || !isConnected}
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 transform -translate-y-1/2"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>

          </div>

          <p className="text-xs text-gray-400 text-center mt-2">
            Use voice recording above or type to chat • Powered by Gemini Live API
          </p>
        </div>
      </div>

      {/* Modals */}
      <Bookmarks 
        isOpen={isBookmarksOpen} 
        onClose={() => setIsBookmarksOpen(false)} 
      />
      <StoryMode 
        isOpen={isStoryModeOpen} 
        onClose={() => setIsStoryModeOpen(false)}
        onStartStory={handleStartStory}
      />
    </div>
  )
}

export default function VoicePage() {
  const { user, isLoaded, isSignedIn } = useUser()
  const router = useRouter()

  // Redirect if not signed in
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/')
    }
  }, [isLoaded, isSignedIn, router])

  if (!isLoaded || !isSignedIn) {
    return <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
    </div>
  }

  return (
    <WebSocketProvider
      serverUrl={process.env.NEXT_PUBLIC_BACKEND_URL || 'ws://localhost:9084'}
      userId={user?.id}
      onTextMessage={(text) => console.log('Text message:', text)}
      onAudioMessage={(audio) => console.log('Audio message:', audio.length)}
      onError={(error) => console.error('WebSocket error:', error)}
    >
      <VoicePageContent />
    </WebSocketProvider>
  )
}