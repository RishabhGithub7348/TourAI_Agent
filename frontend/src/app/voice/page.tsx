'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useUser, useClerk } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { 
  MapPin,
  Bookmark,
  Book,
  LogOut,
  Menu,
  X
} from 'lucide-react'
import { useGeolocation } from '@/hooks/useGeolocation'
import { WebSocketProvider, useWebSocket } from '@/components/WebSocketProvider'
import AudioShare from '@/components/AudioRecorder'
import { Bookmarks } from '@/components/voice/Bookmarks'
import { StoryMode } from '@/components/voice/StoryMode'
import { GoogleMapsService } from '@/services/googleMapsService'
import { LocationService } from '@/services/locationService'
import { AudioVisualization3D } from '@/components/AudioVisualization3D'
import { LanguageSelector } from '@/components/LanguageSelector'


function VoicePageContent() {
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false)
  const [isStoryModeOpen, setIsStoryModeOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { signOut } = useClerk()
  const router = useRouter()

  // Location state management
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [detailedLocation, setDetailedLocation] = useState<any>(null)
  const [isExtractingLocation, setIsExtractingLocation] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)

  // Audio visualization state
  const [isUserSpeaking, setIsUserSpeaking] = useState(false)
  const [isAISpeaking, setIsAISpeaking] = useState(false)
  const [currentAudioLevel, setCurrentAudioLevel] = useState(0)
  const [currentPlaybackLevel, setCurrentPlaybackLevel] = useState(0)

  // Language state
  const [selectedLanguage, setSelectedLanguage] = useState('en-US')

  // Get WebSocket context
  const { isConnected, lastTranscription, playbackAudioLevel } = useWebSocket()
  
  // Geolocation hook
  const { position, loading: locationLoading, locationString, getCurrentPosition, isSupported } = useGeolocation()

  // Request location when component mounts
  useEffect(() => {
    console.log('🚀 Voice page mounted, requesting user location...');
    getCurrentPosition();
  }, []); // Empty dependency array to run only once on mount

  // Extract detailed location when position becomes available
  useEffect(() => {
    const extractLocationDetails = async () => {
      if (!position || isExtractingLocation || detailedLocation) {
        return // Skip if no position, already extracting, or already have data
      }

      console.log('🌍 Starting location extraction from voice page...')
      setIsExtractingLocation(true)
      setLocationError(null)

      try {
        console.log(`📍 User coordinates: ${position.latitude}, ${position.longitude}`)
        console.log(`🎯 Position accuracy: ${position.accuracy}m`)
        
        // First try Google Maps API for precise location
        console.log('🚀 Attempting Google Maps API location extraction...')
        const exactLocation = await GoogleMapsService.getExactLocationFromCoordinates(
          position.latitude, 
          position.longitude
        )

        if (exactLocation) {
          console.log('✅ Google Maps API extraction successful!')
          console.log('📋 Extracted location details:', exactLocation)
          
          // Get nearby places for additional context
          console.log('🎯 Searching for nearby tourist attractions...')
          const nearbyPlaces = await GoogleMapsService.getNearbyPlaces(
            position.latitude,
            position.longitude,
            1000, // 1km radius
            'tourist_attraction'
          )

          const extractedLocationData = {
            exactAddress: exactLocation.fullAddress,
            city: exactLocation.city,
            state: exactLocation.state,
            country: exactLocation.country,
            neighborhood: exactLocation.neighborhood,
            landmark: exactLocation.landmark,
            formattedForAI: exactLocation.formattedForAI,
            nearbyAttractions: nearbyPlaces,
            postalCode: exactLocation.postalCode
          }

          console.log('🎊 Final location data assembled:', extractedLocationData)
          console.log(`🤖 AI will receive: "${exactLocation.formattedForAI}"`)
          
          setDetailedLocation(extractedLocationData)
        } else {
          // Fallback to basic location service
          console.log('🔄 Google Maps failed, falling back to basic location service...')
          const locationDetails = await LocationService.getLocationDetails(
            position.latitude, 
            position.longitude
          )
          
          console.log('📍 Basic location details:', locationDetails)
          
          const fallbackLocationData = {
            exactAddress: locationString || LocationService.formatLocation(locationDetails),
            city: locationDetails.city,
            country: locationDetails.country,
            formattedForAI: locationString || LocationService.formatLocation(locationDetails)
          }
          
          console.log('🔄 Fallback location data:', fallbackLocationData)
          setDetailedLocation(fallbackLocationData)
        }
      } catch (error) {
        console.warn('❌ All location services failed during extraction:', error)
        const emergencyLocationData = {
          exactAddress: `${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)}`,
          formattedForAI: `coordinates ${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)}`
        }
        console.log('💥 Emergency fallback location data:', emergencyLocationData)
        setDetailedLocation(emergencyLocationData)
        setLocationError('Location extraction failed, using coordinates')
      } finally {
        setIsExtractingLocation(false)
      }
    }

    extractLocationDetails()
  }, [position, isExtractingLocation, detailedLocation, locationString])

  // Track transcription states for 3D visualization
  useEffect(() => {
    if (lastTranscription) {
      if (lastTranscription.sender === 'User') {
        setIsUserSpeaking(!lastTranscription.finished)
        setIsAISpeaking(false)
      } else if (lastTranscription.sender === 'Gemini') {
        setIsUserSpeaking(false)
        setIsAISpeaking(!lastTranscription.finished)
      }
    }
  }, [lastTranscription])

  // Track playback audio levels
  useEffect(() => {
    setCurrentPlaybackLevel(playbackAudioLevel)
    if (playbackAudioLevel > 0) {
      setIsAISpeaking(true)
    } else {
      // Small delay before setting AI speaking to false to avoid flickering
      const timeout = setTimeout(() => setIsAISpeaking(false), 500)
      return () => clearTimeout(timeout)
    }
  }, [playbackAudioLevel])

  // Debug logging for location data passed to AudioShare
  useEffect(() => {
    if (detailedLocation) {
      console.log('🏠 VoicePage - Passing locationData to AudioShare:', {
        city: detailedLocation.city,
        state: detailedLocation.state,
        country: detailedLocation.country,
        fullObject: detailedLocation
      });
    }
  }, [detailedLocation]);

  const handleStartStory = (storyId: string) => {
    console.log('Starting story:', storyId)
    setIsStoryModeOpen(false)
    // Here you could integrate story mode with your Gemini backend
  }

  const handleLogout = async () => {
    await signOut()
    router.push('/')
  }

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMobileMenuOpen) {
        const target = event.target as HTMLElement
        const mobileMenu = document.querySelector('[data-mobile-menu]')
        const hamburgerButton = document.querySelector('[data-hamburger]')
        
        if (
          mobileMenu && 
          hamburgerButton &&
          !mobileMenu.contains(target) && 
          !hamburgerButton.contains(target)
        ) {
          setIsMobileMenuOpen(false)
        }
      }
    }

    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isMobileMenuOpen])


  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black relative overflow-hidden">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/10 via-purple-900/10 to-black opacity-50" />
      
      {/* Mobile-Responsive Navbar */}
      <div className="absolute top-0 left-0 right-0 z-20 px-4 py-4 md:px-6 md:py-6">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex flex-col">
            <h1 className="text-lg md:text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              TourGuide AI
            </h1>
            {/* Connection Status */}
            <div className="flex items-center space-x-2 text-xs md:text-sm text-white/60 mt-1">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
              <span className="hidden sm:inline">{isConnected ? 'Connected' : 'Disconnected'}</span>
              <span className="sm:hidden">{isConnected ? '●' : '○'}</span>
            </div>
          </div>

          {/* Mobile: Hamburger Menu Button */}
          <div className="md:hidden">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="w-10 h-10 rounded-full hover:bg-white/10 transition-all duration-300 text-white/60 hover:text-white"
              data-hamburger
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>

          {/* Desktop: Navigation Icons */}
          <div className="hidden md:flex items-center space-x-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={getCurrentPosition}
              disabled={!isSupported || locationLoading}
              title={locationString || (locationError ? 'Location access failed' : 'Get current location')}
              className={`w-10 h-10 rounded-full hover:bg-white/10 transition-all duration-300 ${locationString ? 'text-green-400' : locationError ? 'text-red-400' : 'text-white/60'}`}
            >
              <MapPin className={`w-5 h-5 ${locationLoading ? 'animate-pulse' : ''}`} />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsBookmarksOpen(true)}
              title="Bookmarks"
              className="w-10 h-10 rounded-full hover:bg-white/10 transition-all duration-300 text-white/60 hover:text-white"
            >
              <Bookmark className="w-5 h-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsStoryModeOpen(true)}
              title="Story Mode"
              className="w-10 h-10 rounded-full hover:bg-white/10 transition-all duration-300 text-white/60 hover:text-white"
            >
              <Book className="w-5 h-5" />
            </Button>
            <LanguageSelector 
              selectedLanguage={selectedLanguage}
              onLanguageChange={setSelectedLanguage}
            />
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleLogout}
              title="Logout"
              className="w-10 h-10 rounded-full hover:bg-white/10 transition-all duration-300 text-white/60 hover:text-red-400"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="absolute top-16 left-0 right-0 z-30 md:hidden">
          <div className="mx-4 mt-2 bg-black/90 backdrop-blur-lg rounded-lg border border-white/10 shadow-xl" data-mobile-menu>
            <div className="flex flex-col p-2 space-y-1">
              <Button 
                variant="ghost" 
                onClick={getCurrentPosition}
                disabled={!isSupported || locationLoading}
                className={`w-full justify-start p-3 rounded-lg hover:bg-white/10 transition-all duration-300 ${locationString ? 'text-green-400' : locationError ? 'text-red-400' : 'text-white/60'}`}
              >
                <MapPin className={`w-5 h-5 mr-3 ${locationLoading ? 'animate-pulse' : ''}`} />
                <span>Location</span>
                {locationString && <span className="ml-auto text-xs text-green-400">●</span>}
              </Button>
              
              <Button 
                variant="ghost" 
                onClick={() => {
                  setIsBookmarksOpen(true)
                  setIsMobileMenuOpen(false)
                }}
                className="w-full justify-start p-3 rounded-lg hover:bg-white/10 transition-all duration-300 text-white/60 hover:text-white"
              >
                <Bookmark className="w-5 h-5 mr-3" />
                <span>Bookmarks</span>
              </Button>
              
              <Button 
                variant="ghost" 
                onClick={() => {
                  setIsStoryModeOpen(true)
                  setIsMobileMenuOpen(false)
                }}
                className="w-full justify-start p-3 rounded-lg hover:bg-white/10 transition-all duration-300 text-white/60 hover:text-white"
              >
                <Book className="w-5 h-5 mr-3" />
                <span>Story Mode</span>
              </Button>
              
              <div className="px-3 py-2">
                <div className="text-xs text-white/40 mb-2">Language</div>
                <LanguageSelector 
                  selectedLanguage={selectedLanguage}
                  onLanguageChange={setSelectedLanguage}
                />
              </div>
              
              <Button 
                variant="ghost" 
                onClick={handleLogout}
                className="w-full justify-start p-3 rounded-lg hover:bg-white/10 transition-all duration-300 text-white/60 hover:text-red-400"
              >
                <LogOut className="w-5 h-5 mr-3" />
                <span>Logout</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="absolute inset-0 z-10 flex items-center justify-center pt-20 md:pt-24">
        <div className="flex flex-col items-center space-y-4 md:space-y-8 px-4 w-full max-w-md md:max-w-none">
          {/* 3D Visualization - Responsive Size */}
          <div className="relative flex items-center justify-center w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96">
            <AudioVisualization3D
              isUserSpeaking={isUserSpeaking}
              isAISpeaking={isAISpeaking}
              audioLevel={currentAudioLevel}
              playbackLevel={currentPlaybackLevel}
              isConnected={isConnected}
            />
          </div>
          
          {/* Audio Controls */}
          <div className="w-full max-w-sm">
            <AudioShare 
              locationData={detailedLocation}
              isLocationReady={!!detailedLocation && !isExtractingLocation}
              locationError={locationError}
              selectedLanguage={selectedLanguage}
              onAudioLevelChange={setCurrentAudioLevel}
              onSpeakingStateChange={setIsUserSpeaking}
            />
          </div>
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
  const { isLoaded, isSignedIn, user } = useUser()
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
    <WebSocketProvider url={process.env.NEXT_PUBLIC_BACKEND_URL || "ws://localhost:9084"} userId={user?.id}>
      <VoicePageContent />
    </WebSocketProvider>
  )
}