import { AppConfigService } from '../config/config.service';
export declare class ToolsService {
    private configService;
    private readonly logger;
    private readonly googleMapsClient;
    constructor(configService: AppConfigService);
    getNearbyAttractions(location: string, radius?: number): Promise<string>;
    private calculateDistance;
    getDirections(from: string, to: string, mode?: string): Promise<string>;
    getDiningRecommendations(location: string, cuisine?: string): Promise<string>;
    getTransportationOptions(from: string, to: string): Promise<string>;
    getTourGuideTools(): {
        function_declarations: ({
            name: string;
            description: string;
            parameters: {
                type: string;
                properties: {
                    location: {
                        type: string;
                        description: string;
                    };
                    radius: {
                        type: string;
                        description: string;
                    };
                    from?: undefined;
                    to?: undefined;
                    mode?: undefined;
                    cuisine?: undefined;
                };
                required: string[];
            };
        } | {
            name: string;
            description: string;
            parameters: {
                type: string;
                properties: {
                    from: {
                        type: string;
                        description: string;
                    };
                    to: {
                        type: string;
                        description: string;
                    };
                    mode: {
                        type: string;
                        description: string;
                        enum: string[];
                    };
                    location?: undefined;
                    radius?: undefined;
                    cuisine?: undefined;
                };
                required: string[];
            };
        } | {
            name: string;
            description: string;
            parameters: {
                type: string;
                properties: {
                    location: {
                        type: string;
                        description: string;
                    };
                    cuisine: {
                        type: string;
                        description: string;
                    };
                    radius?: undefined;
                    from?: undefined;
                    to?: undefined;
                    mode?: undefined;
                };
                required: string[];
            };
        } | {
            name: string;
            description: string;
            parameters: {
                type: string;
                properties: {
                    from: {
                        type: string;
                        description: string;
                    };
                    to: {
                        type: string;
                        description: string;
                    };
                    location?: undefined;
                    radius?: undefined;
                    mode?: undefined;
                    cuisine?: undefined;
                };
                required: string[];
            };
        })[];
    };
    handleTourGuideFunction(functionCall: any): Promise<any>;
}
