import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService) {}

  get googleApiKey(): string {
    return this.configService.get<string>('GOOGLE_API_KEY', '');
  }

  get mem0ApiKey(): string {
    return this.configService.get<string>('MEM0_API_KEY', '');
  }

  get googleMapsApiKey(): string {
    return this.configService.get<string>('GOOGLE_MAPS_API_KEY', '');
  }

  get websocketPort(): number {
    return this.configService.get<number>('WEBSOCKET_PORT', 9084);
  }

  get pineconeApiKey(): string {
    return this.configService.get<string>('PINECONE_API_KEY', '');
  }

  get pineconeEnvironment(): string {
    return this.configService.get<string>('PINECONE_ENVIRONMENT', 'us-east-1-aws');
  }

  get pineconeIndexName(): string {
    return this.configService.get<string>('PINECONE_INDEX_NAME', 'tour-bookmarks');
  }

  get openaiApiKey(): string {
    return this.configService.get<string>('OPENAI_API_KEY', '');
  }
}