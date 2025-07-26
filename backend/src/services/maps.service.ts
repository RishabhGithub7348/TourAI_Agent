import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../config/config.service';

interface PlaceDetails {
  name: string;
  address: string;
  rating?: number;
  types: string[];
  distance?: number;
}

interface NearbySearchResult {
  places: PlaceDetails[];
  status: string;
}

@Injectable()
export class MapsService {
  private readonly logger = new Logger(MapsService.name);

  constructor(private configService: AppConfigService) {}

  /**
   * Search for nearby places using Google Maps API
   */
  async searchNearbyPlaces(
    latitude: number,
    longitude: number,
    type: string = 'tourist_attraction',
    radius: number = 5000
  ): Promise<NearbySearchResult> {
    try {
      const apiKey = this.configService.googleMapsApiKey;
      if (!apiKey) {
        this.logger.warn('Google Maps API key not configured');
        return { places: [], status: 'API_KEY_MISSING' };
      }

      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radius}&type=${type}&key=${apiKey}`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK') {
        this.logger.error(`Google Maps API error: ${data.status}`);
        return { places: [], status: data.status };
      }

      const places: PlaceDetails[] = data.results.map((place: any) => ({
        name: place.name,
        address: place.vicinity || place.formatted_address,
        rating: place.rating,
        types: place.types,
        distance: this.calculateDistance(
          latitude,
          longitude,
          place.geometry.location.lat,
          place.geometry.location.lng
        )
      }));

      return { places, status: 'OK' };
    } catch (error) {
      this.logger.error(`Error searching nearby places: ${error.message}`);
      return { places: [], status: 'ERROR' };
    }
  }

  /**
   * Get detailed location information using Google Geocoding API
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<any> {
    try {
      const apiKey = this.configService.googleMapsApiKey;
      if (!apiKey) {
        this.logger.warn('Google Maps API key not configured');
        return null;
      }

      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK' || !data.results.length) {
        this.logger.error(`Geocoding API error: ${data.status}`);
        return null;
      }

      const result = data.results[0];
      const addressComponents = result.address_components;

      return {
        formatted_address: result.formatted_address,
        city: this.getAddressComponent(addressComponents, 'locality'),
        state: this.getAddressComponent(addressComponents, 'administrative_area_level_1'),
        country: this.getAddressComponent(addressComponents, 'country'),
        postal_code: this.getAddressComponent(addressComponents, 'postal_code'),
        neighborhood: this.getAddressComponent(addressComponents, 'neighborhood'),
        place_id: result.place_id
      };
    } catch (error) {
      this.logger.error(`Error in reverse geocoding: ${error.message}`);
      return null;
    }
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI/180);
  }

  private getAddressComponent(components: any[], type: string): string | null {
    const component = components.find(comp => comp.types.includes(type));
    return component ? component.long_name : null;
  }
}