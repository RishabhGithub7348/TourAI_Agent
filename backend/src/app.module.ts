import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VoiceGateway } from './gateways/voice.gateway';
import { GeminiService } from './services/gemini.service';
import { MemoryService } from './services/memory.service';
import { ToolsService } from './services/tools.service';
import { AppConfigService } from './config/config.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  providers: [
    AppConfigService,
    MemoryService,
    ToolsService,
    GeminiService,
    VoiceGateway,
  ],
})
export class AppModule {}