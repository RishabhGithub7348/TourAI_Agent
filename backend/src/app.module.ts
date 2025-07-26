import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VoiceGateway } from './gateways/voice.gateway';
import { GeminiService } from './services/gemini.service';
import { MemoryService } from './services/memory.service';
import { PineconeService } from './services/pinecone.service';
import { ToolsService } from './services/tools.service';
import { AppConfigService } from './config/config.service';
import { TestController } from './controllers/test.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  controllers: [TestController],
  providers: [
    AppConfigService,
    PineconeService,
    MemoryService,
    ToolsService,
    GeminiService,
    VoiceGateway,
  ],
})
export class AppModule {}