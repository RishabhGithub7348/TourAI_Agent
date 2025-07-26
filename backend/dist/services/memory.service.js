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
var MemoryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryService = void 0;
const common_1 = require("@nestjs/common");
const mem0ai_1 = require("mem0ai");
const config_service_1 = require("../config/config.service");
let MemoryService = MemoryService_1 = class MemoryService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(MemoryService_1.name);
        this.FIXED_USER_ID = 'test_user_123';
        this.memory = new mem0ai_1.MemoryClient({
            apiKey: this.configService.mem0ApiKey
        });
    }
    getUserId(sessionId) {
        return this.FIXED_USER_ID;
    }
    async addToMemory(messages, userId, metadata) {
        try {
            const defaultMetadata = { category: 'tour_session' };
            const finalMetadata = metadata || defaultMetadata;
            this.logger.log(`Adding to memory: ${JSON.stringify(messages)}, user_id: ${userId}`);
            const result = await this.memory.add(messages, { user_id: userId });
            this.logger.log(`Added memory: ${JSON.stringify(result)}`);
            return Array.isArray(result) && result.length > 0 ? result[0]?.id || null : null;
        }
        catch (error) {
            this.logger.error(`Error adding to memory: ${error.message}`);
            return null;
        }
    }
    addToMemoryAsync(messages, userId, metadata) {
        const defaultMetadata = { category: 'tour_session' };
        const finalMetadata = metadata || defaultMetadata;
        this.logger.log(`Adding to memory async: ${JSON.stringify(messages)}, user_id: ${userId}`);
        this.memory.add(messages, { user_id: userId })
            .then(result => {
            this.logger.log(`Async memory added: ${JSON.stringify(result)}`);
        })
            .catch(error => {
            this.logger.error(`Error in async memory addition: ${error.message}`);
        });
    }
    async queryMemory(query, userId) {
        try {
            const response = await this.memory.search(query, { user_id: userId });
            let resultMemories = [];
            if (Array.isArray(response)) {
                resultMemories = response.map(item => ({
                    id: item.id || '',
                    memory: item.memory || '',
                    score: item.score || 0,
                }));
            }
            return resultMemories;
        }
        catch (error) {
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
};
exports.MemoryService = MemoryService;
exports.MemoryService = MemoryService = MemoryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.AppConfigService])
], MemoryService);
//# sourceMappingURL=memory.service.js.map