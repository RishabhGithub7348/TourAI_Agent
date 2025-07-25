import { NextRequest, NextResponse } from 'next/server'
import { LocationService } from '@/services/locationService'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { latitude, longitude } = body

    if (!latitude || !longitude) {
      return NextResponse.json(
        { error: 'Latitude and longitude are required' },
        { status: 400 }
      )
    }

    // Get location string
    const locationString = await LocationService.reverseGeocode(latitude, longitude)
    
    // Get detailed location info
    const locationDetails = await LocationService.getLocationDetails(latitude, longitude)
    
    return NextResponse.json({
      locationString,
      details: locationDetails,
      coordinates: { latitude, longitude }
    })
  } catch (error) {
    console.error('Location API error:', error)
    return NextResponse.json(
      { error: 'Failed to get location information' },
      { status: 500 }
    )
  }
}