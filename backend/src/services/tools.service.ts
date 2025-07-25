import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../config/config.service';
import { Client } from '@googlemaps/google-maps-services-js';
import axios from 'axios';

@Injectable()
export class ToolsService {
  private readonly logger = new Logger(ToolsService.name);
  private readonly googleMapsClient: Client;

  constructor(private configService: AppConfigService) {
    this.googleMapsClient = new Client({});
  }

  // Weather information is now handled directly by Google Search integration
  // Users can simply ask "What's the weather in [location]?" and Gemini will use Google Search automatically

  // Get nearby attractions using Google Places API
  async getNearbyAttractions(location: string, radius: number = 5): Promise<string> {
    try {
      const apiKey = this.configService.googleMapsApiKey;
      if (!apiKey) {
        return `Google Maps API key not configured. Please add GOOGLE_MAPS_API_KEY to your environment variables.`;
      }

      // First, geocode the location to get coordinates
      const geocodeResponse = await this.googleMapsClient.geocode({
        params: {
          address: location,
          key: apiKey,
        },
      });

      if (geocodeResponse.data.results.length === 0) {
        return `Location "${location}" not found. Please check the spelling and try again.`;
      }

      const { lat, lng } = geocodeResponse.data.results[0].geometry.location;

      // Search for nearby tourist attractions
      const placesResponse = await this.googleMapsClient.placesNearby({
        params: {
          location: { lat, lng },
          radius: radius * 1000, // Convert km to meters
          type: 'tourist_attraction',
          key: apiKey,
        },
      });

      const attractions = placesResponse.data.results.slice(0, 8).map((place, index) => {
        const rating = place.rating ? `⭐ ${place.rating}` : '';
        const priceLevel = place.price_level ? '💰'.repeat(place.price_level) : '';
        const distance = place.geometry?.location ? 
          this.calculateDistance(lat, lng, place.geometry.location.lat, place.geometry.location.lng) : '';
        
        return `${index + 1}. ${place.name} ${rating} ${priceLevel}${distance ? ` - ${distance}km away` : ''}`;
      });

      if (attractions.length === 0) {
        return `No tourist attractions found near ${location} within ${radius}km radius.`;
      }

      return `🏛️ Top attractions near ${location} (within ${radius}km):\n${attractions.join('\n')}`;
    } catch (error) {
      this.logger.error(`Error getting attractions for ${location}: ${error.message}`);
      return `Unable to get attractions for ${location}. Please try again later.`;
    }
  }

  // Helper function to calculate distance between two coordinates
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): string {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    return distance.toFixed(1);
  }

  // Get directions using Google Directions API
  async getDirections(from: string, to: string, mode: string = 'walking'): Promise<string> {
    try {
      const apiKey = this.configService.googleMapsApiKey;
      if (!apiKey) {
        return `Google Maps API key not configured. Please add GOOGLE_MAPS_API_KEY to your environment variables.`;
      }

      // Map mode to Google Directions API travel mode
      const travelModeMap = {
        'walking': 'walking',
        'driving': 'driving',
        'transit': 'transit',
        'cycling': 'bicycling'
      };

      const travelMode = travelModeMap[mode] || 'walking';

      const directionsResponse = await this.googleMapsClient.directions({
        params: {
          origin: from,
          destination: to,
          mode: travelMode as any,
          key: apiKey,
        },
      });

      if (directionsResponse.data.routes.length === 0) {
        return `No routes found from ${from} to ${to} for ${mode} mode.`;
      }

      const route = directionsResponse.data.routes[0];
      const leg = route.legs[0];
      
      const steps = leg.steps.slice(0, 6).map((step, index) => {
        const instruction = step.html_instructions.replace(/<[^>]*>/g, ''); // Remove HTML tags
        return `${index + 1}. ${instruction} (${step.distance.text})`;
      });

      const modeEmoji = {
        'walking': '🚶',
        'driving': '🚗',
        'transit': '🚌',
        'cycling': '🚲'
      };

      return `${modeEmoji[mode] || '🚶'} Directions from ${from} to ${to} (${mode}):
📍 Distance: ${leg.distance.text}
⏱️ Duration: ${leg.duration.text}

Step-by-step directions:
${steps.join('\n')}

${steps.length < leg.steps.length ? `... and ${leg.steps.length - steps.length} more steps` : ''}`;
    } catch (error) {
      this.logger.error(`Error getting directions from ${from} to ${to}: ${error.message}`);
      return `Unable to get directions from ${from} to ${to}. Please check the locations and try again.`;
    }
  }

  // Get dining recommendations using Google Places API
  async getDiningRecommendations(location: string, cuisine?: string): Promise<string> {
    try {
      const apiKey = this.configService.googleMapsApiKey;
      if (!apiKey) {
        return `Google Maps API key not configured. Please add GOOGLE_MAPS_API_KEY to your environment variables.`;
      }

      // First, geocode the location to get coordinates
      const geocodeResponse = await this.googleMapsClient.geocode({
        params: {
          address: location,
          key: apiKey,
        },
      });

      if (geocodeResponse.data.results.length === 0) {
        return `Location "${location}" not found. Please check the spelling and try again.`;
      }

      const { lat, lng } = geocodeResponse.data.results[0].geometry.location;

      // Build search query
      let keyword = cuisine ? `${cuisine} restaurant` : 'restaurant';

      // Search for nearby restaurants
      const placesResponse = await this.googleMapsClient.placesNearby({
        params: {
          location: { lat, lng },
          radius: 2000, // 2km radius
          type: 'restaurant',
          keyword: keyword,
          key: apiKey,
        },
      });

      const restaurants = placesResponse.data.results
        .filter(place => place.rating && place.rating >= 3.5) // Filter for good ratings
        .slice(0, 6)
        .map((place, index) => {
          const rating = place.rating ? `⭐ ${place.rating}` : '';
          const priceLevel = place.price_level ? '💰'.repeat(place.price_level) : '💰';
          const distance = place.geometry?.location ? 
            this.calculateDistance(lat, lng, place.geometry.location.lat, place.geometry.location.lng) : '';
          const openNow = place.opening_hours?.open_now ? '🟢' : place.opening_hours ? '🔴' : '';
          
          return `${index + 1}. ${place.name} ${rating} ${priceLevel} ${openNow}${distance ? ` - ${distance}km away` : ''}`;
        });

      if (restaurants.length === 0) {
        const cuisineText = cuisine ? ` ${cuisine}` : '';
        return `No${cuisineText} restaurants found near ${location}. Try searching for a different cuisine or location.`;
      }

      const cuisineText = cuisine ? ` ${cuisine}` : '';
      return `🍽️ Recommended${cuisineText} restaurants near ${location}:
${restaurants.join('\n')}

Legend: ⭐ Rating | 💰 Price level | 🟢 Open now | 🔴 Closed`;
    } catch (error) {
      this.logger.error(`Error getting dining recommendations for ${location}: ${error.message}`);
      return `Unable to get dining recommendations for ${location}. Please try again later.`;
    }
  }

  // Get transportation options using Google Directions API
  async getTransportationOptions(from: string, to: string): Promise<string> {
    try {
      const apiKey = this.configService.googleMapsApiKey;
      if (!apiKey) {
        return `Google Maps API key not configured. Please add GOOGLE_MAPS_API_KEY to your environment variables.`;
      }

      const transportModes = [
        { mode: 'walking', emoji: '🚶', name: 'Walking' },
        { mode: 'driving', emoji: '🚗', name: 'Driving' },
        { mode: 'transit', emoji: '🚌', name: 'Public Transit' },
        { mode: 'bicycling', emoji: '🚲', name: 'Cycling' }
      ];

      const results = [];
      
      for (const transport of transportModes) {
        try {
          const response = await this.googleMapsClient.directions({
            params: {
              origin: from,
              destination: to,
              mode: transport.mode as any,
              key: apiKey,
            },
          });

          if (response.data.routes.length > 0) {
            const route = response.data.routes[0];
            const leg = route.legs[0];
            
            let additionalInfo = '';
            if (transport.mode === 'transit' && leg.steps) {
              const transitSteps = leg.steps.filter(step => step.transit_details);
              if (transitSteps.length > 0) {
                const lines = transitSteps.map(step => 
                  `${step.transit_details.line.short_name || step.transit_details.line.name}`
                ).join(', ');
                additionalInfo = ` via ${lines}`;
              }
            }

            results.push(`${transport.emoji} ${transport.name}: ${leg.duration.text} (${leg.distance.text})${additionalInfo}`);
          }
        } catch (modeError) {
          // Skip modes that aren't available for this route
          this.logger.warn(`${transport.name} not available for ${from} to ${to}`);
        }
      }

      if (results.length === 0) {
        return `No transportation options found from ${from} to ${to}. Please check the locations and try again.`;
      }

      return `🚊 Transportation options from ${from} to ${to}:\n${results.join('\n')}`;
    } catch (error) {
      this.logger.error(`Error getting transportation options: ${error.message}`);
      return `Unable to get transportation options from ${from} to ${to}. Please try again later.`;
    }
  }

  // Get tour guide tools configuration for Gemini
  getTourGuideTools() {
    return {
      function_declarations: [
        {
          name: 'get_nearby_attractions',
          description: 'Get nearby tourist attractions and points of interest',
          parameters: {
            type: 'OBJECT',
            properties: {
              location: {
                type: 'STRING',
                description: 'The location to search attractions near',
              },
              radius: {
                type: 'NUMBER',
                description: 'Search radius in kilometers (default: 5)',
              },
            },
            required: ['location'],
          },
        },
        {
          name: 'get_directions',
          description: 'Get directions between two locations',
          parameters: {
            type: 'OBJECT',
            properties: {
              from: {
                type: 'STRING',
                description: 'Starting location',
              },
              to: {
                type: 'STRING',
                description: 'Destination location',
              },
              mode: {
                type: 'STRING',
                description: 'Transportation mode: walking, driving, transit, cycling',
                enum: ['walking', 'driving', 'transit', 'cycling'],
              },
            },
            required: ['from', 'to'],
          },
        },
        {
          name: 'get_dining_recommendations',
          description: 'Get restaurant and dining recommendations for a location',
          parameters: {
            type: 'OBJECT',
            properties: {
              location: {
                type: 'STRING',
                description: 'The location to search restaurants in',
              },
              cuisine: {
                type: 'STRING',
                description: 'Specific cuisine type (optional)',
              },
            },
            required: ['location'],
          },
        },
        {
          name: 'get_transportation_options',
          description: 'Get various transportation options between two locations',
          parameters: {
            type: 'OBJECT',
            properties: {
              from: {
                type: 'STRING',
                description: 'Starting location',
              },
              to: {
                type: 'STRING',
                description: 'Destination location',
              },
            },
            required: ['from', 'to'],
          },
        },
      ],
    };
  }

  // Handle tour guide function calls
  async handleTourGuideFunction(functionCall: any): Promise<any> {
    const { name, args, id: callId } = functionCall;

    try {
      let result: string;

      switch (name) {
        case 'get_nearby_attractions':
          result = await this.getNearbyAttractions(args.location, args.radius);
          break;
        case 'get_directions':
          result = await this.getDirections(args.from, args.to, args.mode);
          break;
        case 'get_dining_recommendations':
          result = await this.getDiningRecommendations(args.location, args.cuisine);
          break;
        case 'get_transportation_options':
          result = await this.getTransportationOptions(args.from, args.to);
          break;
        default:
          result = `Unknown function: ${name}`;
      }

      return {
        id: callId,
        name,
        response: { result },
      };
    } catch (error) {
      this.logger.error(`Error in tour guide function ${name}: ${error.message}`);
      return {
        id: callId,
        name,
        response: { result: `Error: ${error.message}` },
      };
    }
  }
}