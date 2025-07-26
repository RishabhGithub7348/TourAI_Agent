import { ConfigService } from '@nestjs/config';
export declare class AppConfigService {
    private configService;
    constructor(configService: ConfigService);
    get googleApiKey(): string;
    get mem0ApiKey(): string;
    get googleMapsApiKey(): string;
    get websocketPort(): number;
    get pineconeApiKey(): string;
    get pineconeEnvironment(): string;
    get pineconeIndexName(): string;
    get openaiApiKey(): string;
}
