import { AppConfigService } from '../config/config.service';
import { ConversationMessage, MemoryResult } from '../interfaces/conversation.interface';
export declare class MemoryService {
    private configService;
    private readonly logger;
    private memory;
    private readonly FIXED_USER_ID;
    constructor(configService: AppConfigService);
    getUserId(sessionId: string): string;
    addToMemory(messages: ConversationMessage[], userId: string, metadata?: any): Promise<string | null>;
    addToMemoryAsync(messages: ConversationMessage[], userId: string, metadata?: any): void;
    queryMemory(query: string, userId: string): Promise<MemoryResult[]>;
    getMemoryQueryTool(): {
        function_declarations: {
            name: string;
            description: string;
            parameters: {
                type: string;
                properties: {
                    query: {
                        type: string;
                        description: string;
                    };
                };
                required: string[];
            };
        }[];
    };
}
