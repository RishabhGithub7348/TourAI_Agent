import { Injectable, Logger } from '@nestjs/common';
import { MemoryClient } from 'mem0ai';
import { AppConfigService } from '../config/config.service';
import { ConversationMessage, MemoryResult } from '../interfaces/conversation.interface';

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);
  private memory: MemoryClient;
  private readonly FIXED_USER_ID = 'test_user_123';

  constructor(private configService: AppConfigService) {
    this.memory = new MemoryClient({ 
      apiKey: this.configService.mem0ApiKey 
    });
  }

  getUserId(sessionId: string): string {
    return this.FIXED_USER_ID;
  }

  async addToMemory(
    messages: ConversationMessage[],
    userId: string,
    metadata?: any,
  ): Promise<string | null> {
    try {
      const defaultMetadata = { category: 'tour_session' };
      const finalMetadata = metadata || defaultMetadata;

      this.logger.log(`Adding to memory: ${JSON.stringify(messages)}, user_id: ${userId}`);
      
      const result = await this.memory.add(messages, { user_id: userId });
      this.logger.log(`Added memory: ${JSON.stringify(result)}`);
      
      return Array.isArray(result) && result.length > 0 ? result[0]?.id || null : null;
    } catch (error) {
      this.logger.error(`Error adding to memory: ${error.message}`);
      return null;
    }
  }

  async queryMemory(query: string, userId: string): Promise<MemoryResult[]> {
    try {
      const response = await this.memory.search(query, { user_id: userId });
      
      let resultMemories: MemoryResult[] = [];
      
      if (Array.isArray(response)) {
        resultMemories = response.map(item => ({
          id: item.id || '',
          memory: item.memory || '',
          score: item.score || 0,
        }));
      }

      return resultMemories;
    } catch (error) {
      this.logger.error(`Error querying memory: ${error.message}`);
      return [];
    }
  }

  getMemoryQueryTool() {
    return {
      function_declarations: [
        {
          name: 'query_memory',
          description: 'Query the memory database to retrieve relevant past interactions with the user.',
          parameters: {
            type: 'OBJECT',
            properties: {
              query: {
                type: 'STRING',
                description: 'The query string to search the memory.',
              },
            },
            required: ['query'],
          },
        },
      ],
    };
  }
}