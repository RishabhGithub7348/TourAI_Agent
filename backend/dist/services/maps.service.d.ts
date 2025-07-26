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
export declare class MapsService {
    private configService;
    private readonly logger;
    constructor(configService: AppConfigService);
    searchNearbyPlaces(latitude: number, longitude: number, type?: string, radius?: number): Promise<NearbySearchResult>;
    reverseGeocode(latitude: number, longitude: number): Promise<any>;
    private calculateDistance;
    private toRadians;
    private getAddressComponent;
}
export {};
