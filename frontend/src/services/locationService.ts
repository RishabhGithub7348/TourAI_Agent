// Location service for geocoding and reverse geocoding

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationDetails {
  city?: string;
  state?: string;
  country?: string;
  formatted?: string;
  neighborhood?: string;
  postalCode?: string;
}

export class LocationService {
  // Using multiple free geocoding services as fallbacks
  
  /**
   * Convert coordinates to location string using free APIs
   */
  static async reverseGeocode(lat: number, lng: number): Promise<string> {
    // Try multiple services in order
    const services = [
      () => this.nominatimReverse(lat, lng),
      () => this.bigDataCloudReverse(lat, lng),
      () => this.openWeatherReverse(lat, lng),
    ];

    for (const service of services) {
      try {
        const result = await service();
        if (result) return result;
      } catch (error) {
        console.warn('Geocoding service failed, trying next...', error);
      }
    }

    // Fallback to coordinates
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }

  /**
   * OpenStreetMap Nominatim API (free, no key required)
   */
  private static async nominatimReverse(lat: number, lng: number): Promise<string> {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TourGuide-AI-App', // Required by Nominatim
      },
    });
    
    if (!response.ok) throw new Error('Nominatim request failed');
    
    const data = await response.json();
    
    if (data.address) {
      const parts = [
        data.address.city || data.address.town || data.address.village,
        data.address.state || data.address.region,
        data.address.country,
      ].filter(Boolean);
      
      return parts.join(', ') || data.display_name;
    }
    
    throw new Error('No address found');
  }

  /**
   * BigDataCloud API (free tier, no key required)
   */
  private static async bigDataCloudReverse(lat: number, lng: number): Promise<string> {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
    
    const response = await fetch(url);
    
    if (!response.ok) throw new Error('BigDataCloud request failed');
    
    const data = await response.json();
    
    const parts = [
      data.locality || data.city,
      data.principalSubdivision || data.region,
      data.countryName,
    ].filter(Boolean);
    
    return parts.join(', ') || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }

  /**
   * OpenWeatherMap reverse geocoding (requires free API key)
   */
  private static async openWeatherReverse(lat: number, lng: number): Promise<string> {
    // You can get a free API key from openweathermap.org
    const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;
    if (!apiKey) throw new Error('OpenWeather API key not configured');
    
    const url = `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lng}&limit=1&appid=${apiKey}`;
    
    const response = await fetch(url);
    
    if (!response.ok) throw new Error('OpenWeather request failed');
    
    const data = await response.json();
    
    if (data && data[0]) {
      const location = data[0];
      const parts = [
        location.name,
        location.state,
        location.country,
      ].filter(Boolean);
      
      return parts.join(', ');
    }
    
    throw new Error('No location found');
  }

  /**
   * Get detailed location information
   */
  static async getLocationDetails(lat: number, lng: number): Promise<LocationDetails> {
    try {
      const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
      const response = await fetch(url);
      
      if (!response.ok) throw new Error('Failed to get location details');
      
      const data = await response.json();
      
      return {
        city: data.locality || data.city,
        state: data.principalSubdivision,
        country: data.countryName,
        formatted: data.locality ? `${data.locality}, ${data.countryName}` : undefined,
        neighborhood: data.neighbourhood,
        postalCode: data.postcode,
      };
    } catch (error) {
      console.error('Failed to get location details:', error);
      return {
        formatted: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      };
    }
  }

  /**
   * Simple location formatter for display
   */
  static formatLocation(details: LocationDetails): string {
    if (details.formatted) return details.formatted;
    
    const parts = [
      details.neighborhood,
      details.city,
      details.state,
      details.country,
    ].filter(Boolean);
    
    return parts.join(', ') || 'Unknown location';
  }
}