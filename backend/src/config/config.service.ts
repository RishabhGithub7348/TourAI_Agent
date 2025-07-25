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
}