// Google Maps API service for exact location extraction

export interface DetailedLocation {
  fullAddress: string;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  neighborhood?: string | null;
  landmark?: string | null;
  formattedForAI: string;
}

export class GoogleMapsService {
  private static readonly API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  /**
   * Extract exact location details using Google Maps Geocoding API
   */
  static async getExactLocationFromCoordinates(
    latitude: number, 
    longitude: number
  ): Promise<DetailedLocation | null> {
    try {
      console.log(`🔍 Starting location extraction for coordinates: ${latitude}, ${longitude}`);
      
      if (!this.API_KEY) {
        console.warn('❌ Google Maps API key not configured, falling back to basic location');
        return null;
      }

      console.log(`🔑 Google Maps API key found: ${this.API_KEY.substring(0, 10)}...`);

      const url = `/api/google-maps/geocode?lat=${latitude}&lng=${longitude}`;
      console.log(`🌐 Making request to: ${url}`);
      
      const response = await fetch(url);
      console.log(`📡 Response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        throw new Error(`Geocoding request failed: ${response.status}`);
      }

      const data = await response.json();
      console.log(`📊 Geocoding API response status: ${data.status}`);
      console.log(`📍 Number of results: ${data.results?.length || 0}`);
      
      if (data.status !== 'OK' || !data.results.length) {
        console.error(`❌ Geocoding failed with status: ${data.status}`);
        if (data.error_message) {
          console.error(`Error message: ${data.error_message}`);
        }
        throw new Error(`Geocoding failed: ${data.status}`);
      }

      // Get the most precise result (usually the first one)
      const result = data.results[0];
      const components = result.address_components;
      const fullAddress = result.formatted_address;

      console.log(`🏠 Full address from Google: ${fullAddress}`);
      console.log(`🔧 Address components count: ${components?.length || 0}`);

      const locationDetails = this.parseAddressComponents(components, fullAddress);
      console.log(`📋 Parsed location details:`, locationDetails);

      const formattedForAI = this.formatForAI(locationDetails, fullAddress);
      console.log(`🤖 Formatted for AI: ${formattedForAI}`);

      const finalResult = {
        fullAddress,
        city: locationDetails.city,
        state: locationDetails.state,
        country: locationDetails.country,
        postalCode: locationDetails.postalCode,
        neighborhood: locationDetails.neighborhood,
        landmark: locationDetails.landmark,
        formattedForAI
      };

      console.log(`✅ Final location result:`, finalResult);
      return finalResult;

    } catch (error) {
      console.error('❌ Error getting exact location:', error);
      return null;
    }
  }

  /**
   * Parse Google Maps address components into structured data
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static parseAddressComponents(components: any[], fullAddress: string = ''): any {
    console.log(`🔧 Parsing ${components?.length || 0} address components...`);
    
    const getComponent = (type: string) => {
      const component = components.find(comp => comp.types.includes(type));
      const result = component ? component.long_name : null;
      console.log(`  🏷️ ${type}: ${result || 'not found'}`);
      return result;
    };

    // Enhanced city detection - prioritize main city over neighborhoods
    const locality = getComponent('locality');
    const adminLevel2 = getComponent('administrative_area_level_2');
    const adminLevel3 = getComponent('administrative_area_level_3');
    const sublocality = getComponent('sublocality') || getComponent('sublocality_level_1');
    const neighborhood = getComponent('neighborhood');
    
    console.log(`🏙️ City detection analysis:`);
    console.log(`  locality: ${locality}`);
    console.log(`  administrative_area_level_2: ${adminLevel2}`);
    console.log(`  administrative_area_level_3: ${adminLevel3}`);
    console.log(`  sublocality: ${sublocality}`);
    console.log(`  neighborhood: ${neighborhood}`);
    
    // Smart city selection: prefer administrative levels over locality for main cities
    let mainCity = null;
    let neighborhoodArea = null;
    
    // City name mapping for common administrative names to familiar city names
    const cityMapping: { [key: string]: string } = {
      'Bengaluru Urban': 'Bengaluru',
      'Bangalore Urban': 'Bengaluru', 
      'Mumbai Suburban': 'Mumbai',
      'New Delhi': 'Delhi',
      'Chennai': 'Chennai',
      'Hyderabad': 'Hyderabad',
      'Pune': 'Pune',
      'Kolkata': 'Kolkata'
    };
    
    // In India, admin_area_level_2 often contains the main city (like "Bengaluru Urban")
    if (adminLevel2 && (adminLevel2.includes('Urban') || adminLevel2.includes('District') || cityMapping[adminLevel2])) {
      mainCity = cityMapping[adminLevel2] || adminLevel2.replace(' Urban', '').replace(' District', '');
      neighborhoodArea = locality || sublocality || neighborhood;
      console.log(`  🎯 Using admin_level_2 as main city: ${mainCity} (mapped from ${adminLevel2})`);
    }
    // If admin_level_3 looks like a main city name or is mappable
    else if (adminLevel3 && (adminLevel3.length > 3 || cityMapping[adminLevel3])) {
      mainCity = cityMapping[adminLevel3] || adminLevel3;
      neighborhoodArea = locality || sublocality || neighborhood;
      console.log(`  🎯 Using admin_level_3 as main city: ${mainCity}`);
    }
    // Check if locality is actually a known main city
    else if (locality && cityMapping[locality]) {
      mainCity = cityMapping[locality];
      neighborhoodArea = sublocality || neighborhood;
      console.log(`  🎯 Using mapped locality as main city: ${mainCity}`);
    }
    // Special case: Check if full address contains a main city name
    else if (fullAddress) {
      const addressLower = fullAddress.toLowerCase();
      if (addressLower.includes('bengaluru') || addressLower.includes('bangalore')) {
        mainCity = 'Bengaluru';
        neighborhoodArea = locality || sublocality || neighborhood;
        console.log(`  🎯 Detected Bengaluru from full address: ${mainCity}`);
      } else if (addressLower.includes('mumbai')) {
        mainCity = 'Mumbai';
        neighborhoodArea = locality || sublocality || neighborhood;
        console.log(`  🎯 Detected Mumbai from full address: ${mainCity}`);
      } else if (addressLower.includes('delhi')) {
        mainCity = 'Delhi';
        neighborhoodArea = locality || sublocality || neighborhood;
        console.log(`  🎯 Detected Delhi from full address: ${mainCity}`);
      } else {
        mainCity = locality || adminLevel2;
        neighborhoodArea = sublocality || neighborhood;
        console.log(`  🎯 Using fallback as main city: ${mainCity}`);
      }
    }
    // Final fallback
    else {
      mainCity = locality || adminLevel2;
      neighborhoodArea = sublocality || neighborhood;
      console.log(`  🎯 Using final fallback as main city: ${mainCity}`);
    }

    const parsed = {
      streetNumber: getComponent('street_number'),
      streetName: getComponent('route'),
      neighborhood: neighborhoodArea,
      city: mainCity,
      state: getComponent('administrative_area_level_1'),
      country: getComponent('country'),
      postalCode: getComponent('postal_code'),
      landmark: getComponent('point_of_interest') || getComponent('establishment')
    };

    console.log(`📋 Final parsed components:`, parsed);
    return parsed;
  }

  /**
   * Format location data specifically for AI tour guide context
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static formatForAI(details: any, fullAddress: string): string {
    console.log(`🤖 Formatting location for AI with details:`, details);
    console.log(`📍 Full address provided: ${fullAddress}`);
    
    const parts = [];

    // Primary location
    if (details.city && details.state && details.country) {
      const primary = `${details.city}, ${details.state}, ${details.country}`;
      parts.push(primary);
      console.log(`  ✅ Added primary location: ${primary}`);
    } else if (fullAddress) {
      parts.push(fullAddress);
      console.log(`  ✅ Added full address as primary: ${fullAddress}`);
    }

    // Add neighborhood for local context
    if (details.neighborhood && details.neighborhood !== details.city) {
      const neighborhood = `in the ${details.neighborhood} area`;
      parts.push(neighborhood);
      console.log(`  ✅ Added neighborhood: ${neighborhood}`);
    }

    // Add landmark if available
    if (details.landmark) {
      const landmark = `near ${details.landmark}`;
      parts.push(landmark);
      console.log(`  ✅ Added landmark: ${landmark}`);
    }

    // Add street address for very specific location
    if (details.streetName) {
      const streetAddress = [details.streetNumber, details.streetName].filter(Boolean).join(' ');
      if (streetAddress) {
        const street = `on ${streetAddress}`;
        parts.push(street);
        console.log(`  ✅ Added street: ${street}`);
      }
    }

    const result = parts.join(', ');
    console.log(`🎯 Final AI-formatted location: "${result}"`);
    return result;
  }

  /**
   * Get nearby places for context (optional enhancement)
   */
  static async getNearbyPlaces(
    latitude: number,
    longitude: number,
    radius: number = 1000,
    type: string = 'tourist_attraction'
  ): Promise<string[]> {
    try {
      console.log(`🎯 Searching for nearby ${type} within ${radius}m of ${latitude}, ${longitude}`);
      
      if (!this.API_KEY) {
        console.warn('❌ No API key available for nearby places search');
        return [];
      }

      const url = `/api/google-maps/places?lat=${latitude}&lng=${longitude}&radius=${radius}&type=${type}`;
      console.log(`🌐 Places API request: ${url}`);
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log(`📊 Places API response status: ${data.status}`);
      console.log(`🏛️ Found ${data.results?.length || 0} places`);
      
      if (data.status !== 'OK') {
        console.warn(`❌ Places API failed: ${data.status}`);
        if (data.error_message) {
          console.error(`Error: ${data.error_message}`);
        }
        return [];
      }

      const places = data.results
        .slice(0, 5) // Top 5 nearby places
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((place: any) => place.name)
        .filter(Boolean);

      console.log(`✅ Nearby places found: ${places.join(', ')}`);
      return places;

    } catch (error) {
      console.error('❌ Error getting nearby places:', error);
      return [];
    }
  }
}