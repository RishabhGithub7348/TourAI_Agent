'use client'

import { useState, useEffect, useRef } from 'react'
import { LocationService } from '@/services/locationService'

export interface CustomGeolocationPosition {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
}

export interface GeolocationError {
  code: number
  message: string
}

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean
  timeout?: number
  maximumAge?: number
  watch?: boolean
}

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const [position, setPosition] = useState<CustomGeolocationPosition | null>(null)
  const [error, setError] = useState<GeolocationError | null>(null)
  const [loading, setLoading] = useState(false)
  const [locationString, setLocationString] = useState<string | null>(null)
  
  const watchIdRef = useRef<number | null>(null)
  
  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 300000, // 5 minutes
    watch = false
  } = options

  // Reverse geocoding to get readable location
  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      return await LocationService.reverseGeocode(lat, lng);
    } catch (error) {
      console.warn('Reverse geocoding failed:', error);
      // Fallback to coordinates
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  }

  const getCurrentPosition = () => {
    if (typeof window === 'undefined' || !window.navigator?.geolocation) {
      setError({
        code: 0,
        message: 'Geolocation is not supported by this browser'
      })
      return
    }

    setLoading(true)
    setError(null)

    const successCallback = async (pos: globalThis.GeolocationPosition) => {
      const newPosition = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: pos.timestamp
      }
      
      setPosition(newPosition)
      setLoading(false)
      
      // Get readable location
      try {
        const locationStr = await reverseGeocode(
          newPosition.latitude, 
          newPosition.longitude
        )
        setLocationString(locationStr)
      } catch (error) {
        console.warn('Failed to get location string:', error)
      }
    }

    const errorCallback = (err: GeolocationPositionError) => {
      let message: string
      
      switch (err.code) {
        case err.PERMISSION_DENIED:
          message = 'Location access denied by user'
          break
        case err.POSITION_UNAVAILABLE:
          message = 'Location information unavailable'
          break
        case err.TIMEOUT:
          message = 'Location request timed out'
          break
        default:
          message = 'An unknown error occurred'
          break
      }
      
      setError({
        code: err.code,
        message
      })
      setLoading(false)
    }

    const geoOptions: PositionOptions = {
      enableHighAccuracy,
      timeout,
      maximumAge
    }

    if (watch) {
      // Start watching position
      if (watchIdRef.current !== null) {
        window.navigator.geolocation.clearWatch(watchIdRef.current)
      }
      
      watchIdRef.current = window.navigator.geolocation.watchPosition(
        successCallback,
        errorCallback,
        geoOptions
      )
    } else {
      // Get position once
      window.navigator.geolocation.getCurrentPosition(
        successCallback,
        errorCallback,
        geoOptions
      )
    }
  }

  const clearWatch = () => {
    if (typeof window !== 'undefined' && watchIdRef.current !== null) {
      window.navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }

  useEffect(() => {
    return () => {
      clearWatch()
    }
  }, [])

  return {
    position,
    error,
    loading,
    locationString,
    getCurrentPosition,
    clearWatch,
    isSupported: typeof window !== 'undefined' && !!window.navigator?.geolocation
  }
}