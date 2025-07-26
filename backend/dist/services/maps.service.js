"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var MapsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MapsService = void 0;
const common_1 = require("@nestjs/common");
const config_service_1 = require("../config/config.service");
let MapsService = MapsService_1 = class MapsService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(MapsService_1.name);
    }
    async searchNearbyPlaces(latitude, longitude, type = 'tourist_attraction', radius = 5000) {
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
            const places = data.results.map((place) => ({
                name: place.name,
                address: place.vicinity || place.formatted_address,
                rating: place.rating,
                types: place.types,
                distance: this.calculateDistance(latitude, longitude, place.geometry.location.lat, place.geometry.location.lng)
            }));
            return { places, status: 'OK' };
        }
        catch (error) {
            this.logger.error(`Error searching nearby places: ${error.message}`);
            return { places: [], status: 'ERROR' };
        }
    }
    async reverseGeocode(latitude, longitude) {
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
        }
        catch (error) {
            this.logger.error(`Error in reverse geocoding: ${error.message}`);
            return null;
        }
    }
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }
    getAddressComponent(components, type) {
        const component = components.find(comp => comp.types.includes(type));
        return component ? component.long_name : null;
    }
};
exports.MapsService = MapsService;
exports.MapsService = MapsService = MapsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.AppConfigService])
], MapsService);
//# sourceMappingURL=maps.service.js.map