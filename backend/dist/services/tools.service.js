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
var ToolsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolsService = void 0;
const common_1 = require("@nestjs/common");
const config_service_1 = require("../config/config.service");
const google_maps_services_js_1 = require("@googlemaps/google-maps-services-js");
let ToolsService = ToolsService_1 = class ToolsService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(ToolsService_1.name);
        this.googleMapsClient = new google_maps_services_js_1.Client({});
    }
    async getNearbyAttractions(location, radius = 5) {
        try {
            const apiKey = this.configService.googleMapsApiKey;
            if (!apiKey) {
                return `Google Maps API key not configured. Please add GOOGLE_MAPS_API_KEY to your environment variables.`;
            }
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
            const placesResponse = await this.googleMapsClient.placesNearby({
                params: {
                    location: { lat, lng },
                    radius: radius * 1000,
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
            const tips = [
                'Check opening hours and ticket prices before visiting',
                'Consider visiting popular attractions early morning or late afternoon',
                'Look for combo tickets that include multiple attractions',
                'Download offline maps in case of poor internet connection'
            ];
            return this.formatTourGuideResponse(`Top Attractions Near ${location}`, `Found ${attractions.length} amazing places within ${radius}km:\n\n${attractions.join('\n')}`, tips);
        }
        catch (error) {
            this.logger.error(`Error getting attractions for ${location}: ${error.message}`);
            return `Unable to get attractions for ${location}. Please try again later.`;
        }
    }
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;
        return distance.toFixed(1);
    }
    async getDirections(from, to, mode = 'walking') {
        try {
            const apiKey = this.configService.googleMapsApiKey;
            if (!apiKey) {
                return `Google Maps API key not configured. Please add GOOGLE_MAPS_API_KEY to your environment variables.`;
            }
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
                    mode: travelMode,
                    key: apiKey,
                },
            });
            if (directionsResponse.data.routes.length === 0) {
                return `No routes found from ${from} to ${to} for ${mode} mode.`;
            }
            const route = directionsResponse.data.routes[0];
            const leg = route.legs[0];
            const steps = leg.steps.slice(0, 6).map((step, index) => {
                const instruction = step.html_instructions.replace(/<[^>]*>/g, '');
                return `${index + 1}. ${instruction} (${step.distance.text})`;
            });
            const modeEmoji = {
                'walking': '🚶',
                'driving': '🚗',
                'transit': '🚌',
                'cycling': '🚲'
            };
            const content = `📍 **Distance:** ${leg.distance.text}
⏱️ **Duration:** ${leg.duration.text}
🚶 **Mode:** ${mode.charAt(0).toUpperCase() + mode.slice(1)}

**Step-by-step directions:**
${steps.join('\n')}

${steps.length < leg.steps.length ? `... and ${leg.steps.length - steps.length} more steps` : ''}`;
            const tips = [
                'Check traffic conditions before starting your journey',
                'Keep your phone charged for navigation',
                'Have a backup route in mind',
                'Consider weather conditions that might affect travel time'
            ];
            return this.formatTourGuideResponse(`Directions from ${from} to ${to}`, content, tips);
        }
        catch (error) {
            this.logger.error(`Error getting directions from ${from} to ${to}: ${error.message}`);
            return `Unable to get directions from ${from} to ${to}. Please check the locations and try again.`;
        }
    }
    async getDiningRecommendations(location, cuisine) {
        try {
            const apiKey = this.configService.googleMapsApiKey;
            if (!apiKey) {
                return `Google Maps API key not configured. Please add GOOGLE_MAPS_API_KEY to your environment variables.`;
            }
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
            let keyword = cuisine ? `${cuisine} restaurant` : 'restaurant';
            const placesResponse = await this.googleMapsClient.placesNearby({
                params: {
                    location: { lat, lng },
                    radius: 2000,
                    type: 'restaurant',
                    keyword: keyword,
                    key: apiKey,
                },
            });
            const restaurants = placesResponse.data.results
                .filter(place => place.rating && place.rating >= 3.5)
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
            const content = `Found ${restaurants.length} excellent${cuisineText} restaurants:\n\n${restaurants.join('\n')}\n\n**Legend:** ⭐ Rating | 💰 Price level | 🟢 Open now | 🔴 Closed`;
            const tips = [
                'Make reservations for popular restaurants, especially on weekends',
                'Check recent reviews and current menu online',
                'Ask about daily specials and local dishes',
                'Consider dietary restrictions and inform the restaurant ahead'
            ];
            return this.formatTourGuideResponse(`Dining Recommendations${cuisineText ? ` - ${cuisine.charAt(0).toUpperCase() + cuisine.slice(1)}` : ''} Near ${location}`, content, tips);
        }
        catch (error) {
            this.logger.error(`Error getting dining recommendations for ${location}: ${error.message}`);
            return `Unable to get dining recommendations for ${location}. Please try again later.`;
        }
    }
    async getTransportationOptions(from, to) {
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
                            mode: transport.mode,
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
                                const lines = transitSteps.map(step => `${step.transit_details.line.short_name || step.transit_details.line.name}`).join(', ');
                                additionalInfo = ` via ${lines}`;
                            }
                        }
                        results.push(`${transport.emoji} ${transport.name}: ${leg.duration.text} (${leg.distance.text})${additionalInfo}`);
                    }
                }
                catch (modeError) {
                    this.logger.warn(`${transport.name} not available for ${from} to ${to}`);
                }
            }
            if (results.length === 0) {
                return `No transportation options found from ${from} to ${to}. Please check the locations and try again.`;
            }
            const content = `Here are all available transportation methods:\n\n${results.join('\n')}`;
            const tips = [
                'Compare costs and convenience for your specific needs',
                'Check for any seasonal service changes or disruptions',
                'Consider combining different modes for optimal travel',
                'Book tickets in advance for public transit when possible'
            ];
            return this.formatTourGuideResponse(`Transportation Options from ${from} to ${to}`, content, tips);
        }
        catch (error) {
            this.logger.error(`Error getting transportation options: ${error.message}`);
            return `Unable to get transportation options from ${from} to ${to}. Please try again later.`;
        }
    }
    formatTourGuideResponse(title, content, tips) {
        let response = `🌟 ${title}\n${'='.repeat(title.length + 4)}\n\n${content}`;
        if (tips && tips.length > 0) {
            response += `\n\n💡 **Pro Tips:**\n${tips.map(tip => `• ${tip}`).join('\n')}`;
        }
        response += `\n\n---\n*I'm here to help make your travel experience amazing! Ask me anything else about your destination.*`;
        return response;
    }
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
    async handleTourGuideFunction(functionCall) {
        const { name, args, id: callId } = functionCall;
        try {
            let result;
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
        }
        catch (error) {
            this.logger.error(`Error in tour guide function ${name}: ${error.message}`);
            return {
                id: callId,
                name,
                response: { result: `Error: ${error.message}` },
            };
        }
    }
};
exports.ToolsService = ToolsService;
exports.ToolsService = ToolsService = ToolsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.AppConfigService])
], ToolsService);
//# sourceMappingURL=tools.service.js.map