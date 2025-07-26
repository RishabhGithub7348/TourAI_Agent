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
const memory_service_1 = require("./memory.service");
const google_maps_services_js_1 = require("@googlemaps/google-maps-services-js");
let ToolsService = ToolsService_1 = class ToolsService {
    constructor(configService, memoryService) {
        this.configService = configService;
        this.memoryService = memoryService;
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
    async saveBookmark(content, type, context, userId) {
        try {
            console.log('📚 ToolsService - VOICE BOOKMARK SAVE ATTEMPT:');
            console.log('📚 Content length:', content?.length || 0);
            console.log('📚 Content preview:', content?.substring(0, 200) || 'NO CONTENT');
            console.log('📚 Type:', type);
            console.log('📚 Context:', context);
            console.log('📚 UserId:', userId);
            console.log('📚 ToolsService - Saving bookmark:', { content, type, context, userId });
            const contentType = type || this.determineContentType(content);
            const bookmarkData = {
                title: this.extractTitle(content, contentType),
                description: content.trim(),
                location: this.extractLocation(content),
                category: contentType,
                url: ''
            };
            const finalUserId = userId || 'test_user_123';
            console.log('📚 ToolsService - Using userId for bookmark:', finalUserId);
            console.log('📚 ToolsService - Bookmark data to save:', bookmarkData);
            const bookmarkId = await this.memoryService.addBookmark(bookmarkData, finalUserId);
            if (bookmarkId) {
                const successMessage = `✅ Saved to your bookmarks! I've saved this ${contentType} so you can remember it later.`;
                console.log('✅ ToolsService - Bookmark saved with ID:', bookmarkId);
                return this.formatTourGuideResponse('📚 Bookmark Saved', successMessage, ['Say "show my bookmarks" to see all your saved items', 'I can save any interesting stories, places, food, or memories you want to remember']);
            }
            else {
                const errorMessage = `❌ Sorry, I couldn't save that to your bookmarks. Please try again.`;
                console.error('❌ ToolsService - Bookmark save failed');
                return this.formatTourGuideResponse('❌ Save Failed', errorMessage, ['Check your internet connection', 'Try rephrasing what you want to save']);
            }
        }
        catch (error) {
            this.logger.error(`Error saving bookmark: ${error.message}`);
            console.error('❌ ToolsService - Bookmark save error:', error);
            return `❌ Failed to save bookmark: ${error.message}`;
        }
    }
    determineContentType(content) {
        const lowerContent = content.toLowerCase();
        if (lowerContent.includes('restaurant') || lowerContent.includes('food') || lowerContent.includes('dish') || lowerContent.includes('cuisine')) {
            return 'food';
        }
        else if (lowerContent.includes('museum') || lowerContent.includes('attraction') || lowerContent.includes('temple') || lowerContent.includes('park')) {
            return 'place';
        }
        else if (lowerContent.includes('story') || lowerContent.includes('experience') || lowerContent.includes('memory')) {
            return 'memory';
        }
        else if (lowerContent.includes('tip') || lowerContent.includes('advice') || lowerContent.includes('recommend')) {
            return 'tip';
        }
        else if (lowerContent.includes('hotel') || lowerContent.includes('accommodation')) {
            return 'accommodation';
        }
        else {
            return 'general';
        }
    }
    extractTitle(content, type) {
        const words = content.split(' ');
        if (words.length <= 8) {
            return content;
        }
        if (type === 'food') {
            const foodMatch = content.match(/(?:restaurant|dish|cuisine|food)\s+[\w\s]{1,30}/i);
            if (foodMatch)
                return foodMatch[0];
        }
        else if (type === 'place') {
            const placeMatch = content.match(/(?:museum|temple|park|attraction)\s+[\w\s]{1,30}/i);
            if (placeMatch)
                return placeMatch[0];
        }
        return words.slice(0, 8).join(' ') + '...';
    }
    extractLocation(content) {
        const locationMatch = content.match(/(?:in|at|near)\s+([\w\s]{2,30})(?:\s|$|,|\.)/i);
        return locationMatch ? locationMatch[1].trim() : '';
    }
    async getBookmarks(userId) {
        try {
            const finalUserId = userId || 'test_user_123';
            console.log('📚 ToolsService - Getting bookmarks for user:', finalUserId);
            const bookmarks = await this.memoryService.getBookmarks(finalUserId);
            if (bookmarks.length === 0) {
                return this.formatTourGuideResponse('📚 Your Saved Items', 'You haven\'t saved anything yet! During our conversations, whenever you find something interesting - a place, food recommendation, story, or memory - just say "save this" and I\'ll bookmark it for you.', ['Try saying "save this" when I mention something interesting', 'I can save places, food recommendations, stories, tips, or any memories you want to keep']);
            }
            const bookmarksByCategory = bookmarks.reduce((acc, bookmark) => {
                const memoryText = bookmark.memory;
                const titleMatch = memoryText.match(/User saved bookmark: "([^"]+)"/);
                const title = titleMatch ? titleMatch[1] : 'Untitled';
                const descMatch = memoryText.match(/" - ([^(]+)/);
                const description = descMatch ? descMatch[1].trim() : 'No description';
                const locationMatch = memoryText.match(/\(Location: ([^)]+)\)/);
                const location = locationMatch ? locationMatch[1] : '';
                const category = this.determineContentType(description);
                if (!acc[category]) {
                    acc[category] = [];
                }
                acc[category].push({
                    title,
                    description,
                    location
                });
                return acc;
            }, {});
            const categoryEmojis = {
                food: '🍽️',
                place: '📍',
                memory: '💭',
                tip: '💡',
                accommodation: '🏨',
                general: '📝'
            };
            let content = `You have ${bookmarks.length} saved item${bookmarks.length === 1 ? '' : 's'}:\n\n`;
            Object.entries(bookmarksByCategory).forEach(([category, items]) => {
                const emoji = categoryEmojis[category] || '📝';
                const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
                content += `${emoji} **${categoryName}${items.length > 1 ? 's' : ''}** (${items.length})\n`;
                items.forEach((item, index) => {
                    const locationText = item.location ? ` 📍 ${item.location}` : '';
                    content += `   ${index + 1}. ${item.title}${locationText}\n`;
                    if (item.description !== item.title) {
                        content += `      ${item.description.substring(0, 100)}${item.description.length > 100 ? '...' : ''}\n`;
                    }
                });
                content += '\n';
            });
            console.log('✅ ToolsService - Retrieved bookmarks:', bookmarks.length);
            return this.formatTourGuideResponse('📚 Your Saved Collection', content, ['Say "save this" whenever I mention something you want to remember', 'I can save any type of content - places, food, stories, tips, or memories']);
        }
        catch (error) {
            this.logger.error(`Error getting bookmarks: ${error.message}`);
            console.error('❌ ToolsService - Get bookmarks error:', error);
            return `❌ Failed to retrieve bookmarks: ${error.message}`;
        }
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
                {
                    name: 'save_bookmark',
                    description: 'Save any interesting content from the conversation as a bookmark - places, food recommendations, stories, memories, tips, or any other content the user wants to remember',
                    parameters: {
                        type: 'OBJECT',
                        properties: {
                            content: {
                                type: 'STRING',
                                description: 'The content to save - can be about places, food, stories, memories, tips, or any interesting information',
                            },
                            type: {
                                type: 'STRING',
                                description: 'Type of content: food, place, memory, tip, accommodation, or general (optional)',
                            },
                            context: {
                                type: 'STRING',
                                description: 'Additional context about why this is being saved (optional)',
                            },
                        },
                        required: ['content'],
                    },
                },
                {
                    name: 'get_bookmarks',
                    description: 'Retrieve all saved bookmarks for the user',
                    parameters: {
                        type: 'OBJECT',
                        properties: {},
                        required: [],
                    },
                },
            ],
        };
    }
    async handleTourGuideFunction(functionCall, userId) {
        const { name, args, id: callId } = functionCall;
        try {
            let result;
            console.log(`🔧 ToolsService - Handling function: ${name} with args:`, args);
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
                case 'save_bookmark':
                    result = await this.saveBookmark(args.content, args.type, args.context, userId);
                    break;
                case 'get_bookmarks':
                    result = await this.getBookmarks(userId);
                    break;
                default:
                    result = `Unknown function: ${name}`;
            }
            console.log(`✅ ToolsService - Function ${name} completed successfully`);
            return {
                id: callId,
                name,
                response: { result },
            };
        }
        catch (error) {
            this.logger.error(`Error in tour guide function ${name}: ${error.message}`);
            console.error(`❌ ToolsService - Function ${name} error:`, error);
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
    __metadata("design:paramtypes", [config_service_1.AppConfigService,
        memory_service_1.MemoryService])
], ToolsService);
//# sourceMappingURL=tools.service.js.map