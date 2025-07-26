'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { 
  MapPin,
  Bookmark,
  Book
} from 'lucide-react'
import { useGeolocation } from '@/hooks/useGeolocation'
import { WebSocketProvider, useWebSocket } from '@/components/WebSocketProvider'
import AudioShare from '@/components/AudioRecorder'
import { Bookmarks } from '@/components/voice/Bookmarks'
import { StoryMode } from '@/components/voice/StoryMode'
import { GoogleMapsService } from '@/services/googleMapsService'
import { LocationService } from '@/services/locationService'


function VoicePageContent() {
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false)
  const [isStoryModeOpen, setIsStoryModeOpen] = useState(false)

  // Location state management
  const [detailedLocation, setDetailedLocation] = useState<any>(null)
  const [isExtractingLocation, setIsExtractingLocation] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)

  // Get WebSocket context
  const { isConnected } = useWebSocket()
  
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

  const handleStartStory = (storyId: string) => {
    console.log('Starting story:', storyId)
    setIsStoryModeOpen(false)
    // Here you could integrate story mode with your Gemini backend
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex flex-col">
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
                </div>
                {locationString && (
                  <div className="flex items-center space-x-2 text-xs text-green-400">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate max-w-48">{locationString}</span>
                  </div>
                )}
                {isExtractingLocation && (
                  <div className="flex items-center space-x-2 text-xs text-yellow-400">
                    <div className="w-3 h-3 border border-yellow-400 border-t-transparent rounded-full animate-spin" />
                    <span>Getting location details...</span>
                  </div>
                )}
                {detailedLocation && !isExtractingLocation && (
                  <div className="flex items-center space-x-2 text-xs text-blue-400">
                    <div className="w-3 h-3 bg-blue-400 rounded-full" />
                    <span>Location ready for AI</span>
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

      {/* Main Content */}
      <div className="flex-1 container mx-auto p-4">
        <AudioShare 
          locationData={detailedLocation}
          isLocationReady={!!detailedLocation && !isExtractingLocation}
          locationError={locationError}
        />
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
  const { isLoaded, isSignedIn } = useUser()
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
    <WebSocketProvider url="ws://localhost:9084">
      <VoicePageContent />
    </WebSocketProvider>
  )
}