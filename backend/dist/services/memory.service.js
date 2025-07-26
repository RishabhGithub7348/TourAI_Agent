"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var MemoryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryService = void 0;
const common_1 = require("@nestjs/common");
const mem0ai_1 = require("mem0ai");
const config_service_1 = require("../config/config.service");
const fs = __importStar(require("fs/promises"));
const fsSync = __importStar(require("fs"));
const path = __importStar(require("path"));
const uuid_1 = require("uuid");
let MemoryService = MemoryService_1 = class MemoryService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(MemoryService_1.name);
        this.FIXED_USER_ID = 'test_user_123';
        this.BOOKMARKS_DIR = path.join(process.cwd(), 'data', 'bookmarks');
        this.memory = new mem0ai_1.MemoryClient({
            apiKey: this.configService.mem0ApiKey
        });
        this.ensureBookmarksDirectory();
    }
    ensureBookmarksDirectory() {
        try {
            if (!fsSync.existsSync(this.BOOKMARKS_DIR)) {
                fsSync.mkdirSync(this.BOOKMARKS_DIR, { recursive: true });
                console.log(`📁 Created bookmarks directory: ${this.BOOKMARKS_DIR}`);
            }
        }
        catch (error) {
            console.error(`❌ Failed to create bookmarks directory: ${error.message}`);
        }
    }
    getUserId(sessionId) {
        return this.FIXED_USER_ID;
    }
    async addToMemory(messages, userId, metadata) {
        try {
            const defaultMetadata = { category: 'tour_session' };
            const finalMetadata = metadata || defaultMetadata;
            this.logger.log(`🧠 Adding to memory: ${JSON.stringify(messages)}, user_id: ${userId}`);
            console.log(`🧠 Memory Service - Adding messages:`, messages);
            const result = await this.memory.add(messages, { user_id: userId, metadata: finalMetadata });
            this.logger.log(`✅ Added memory: ${JSON.stringify(result)}`);
            console.log(`✅ Memory Service - Added result:`, result);
            return Array.isArray(result) && result.length > 0 ? result[0]?.id || null : null;
        }
        catch (error) {
            this.logger.error(`❌ Error adding to memory: ${error.message}`);
            console.error(`❌ Memory Service - Error:`, error);
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
    async addBookmark(bookmarkData, userId) {
        try {
            const bookmarkMessage = `User saved bookmark: "${bookmarkData.title}" - ${bookmarkData.description}${bookmarkData.location ? ` (Location: ${bookmarkData.location})` : ''}${bookmarkData.url ? ` (URL: ${bookmarkData.url})` : ''}`;
            const metadata = {
                category: 'bookmark',
                bookmark_title: bookmarkData.title,
                bookmark_category: bookmarkData.category || 'general',
                bookmark_location: bookmarkData.location || '',
            };
            this.logger.log(`📚 Adding bookmark to memory: ${bookmarkData.title} for user: ${userId}`);
            console.log(`📚 Bookmark Service - Adding bookmark:`, bookmarkData);
            console.log(`📚 Bookmark Service - Mem0 API Key exists: ${!!this.configService.mem0ApiKey}`);
            try {
                const result = await this.memory.add([{
                        role: 'user',
                        content: bookmarkMessage
                    }], {
                    user_id: userId,
                    metadata: metadata
                });
                this.logger.log(`✅ Mem0 bookmark saved: ${JSON.stringify(result)}`);
                console.log(`✅ Bookmark Service - Mem0 saved result:`, result);
                return Array.isArray(result) && result.length > 0 ? result[0]?.id || null : null;
            }
            catch (mem0Error) {
                this.logger.error(`❌ Mem0 failed, trying file backup: ${mem0Error.message}`);
                console.error(`❌ Mem0 error details:`, mem0Error);
                return await this.addBookmarkToFile(bookmarkData, userId);
            }
        }
        catch (error) {
            this.logger.error(`❌ Error saving bookmark: ${error.message}`);
            console.error(`❌ Bookmark Service - Error:`, error);
            try {
                return await this.addBookmarkToFile(bookmarkData, userId);
            }
            catch (fileError) {
                console.error(`❌ File backup also failed:`, fileError);
                return null;
            }
        }
    }
    async getBookmarks(userId) {
        try {
            this.logger.log(`📚 Retrieving bookmarks for user: ${userId}`);
            console.log(`📚 Bookmark Service - Getting bookmarks for user:`, userId);
            try {
                const response = await this.memory.search('bookmark', {
                    user_id: userId,
                    limit: 50
                });
                let bookmarks = [];
                if (Array.isArray(response)) {
                    bookmarks = response
                        .filter(item => item.memory && item.memory.includes('User saved bookmark:'))
                        .map(item => ({
                        id: item.id || '',
                        memory: item.memory || '',
                        score: item.score || 0,
                    }));
                }
                this.logger.log(`📚 Retrieved ${bookmarks.length} bookmarks from mem0`);
                console.log(`📚 Bookmark Service - Retrieved mem0 bookmarks:`, bookmarks);
                return bookmarks;
            }
            catch (mem0Error) {
                this.logger.error(`❌ Mem0 retrieval failed, trying file backup: ${mem0Error.message}`);
                return await this.getBookmarksFromFile(userId);
            }
        }
        catch (error) {
            this.logger.error(`❌ Error retrieving bookmarks: ${error.message}`);
            console.error(`❌ Bookmark Service - Error:`, error);
            try {
                return await this.getBookmarksFromFile(userId);
            }
            catch (fileError) {
                console.error(`❌ File backup retrieval also failed:`, fileError);
                return [];
            }
        }
    }
    async addBookmarkToFile(bookmarkData, userId) {
        try {
            console.log(`📁 File Storage - Starting bookmark save for user: ${userId}`);
            const bookmarkId = (0, uuid_1.v4)();
            const timestamp = new Date().toISOString();
            const bookmark = {
                id: bookmarkId,
                userId,
                title: bookmarkData.title,
                description: bookmarkData.description,
                location: bookmarkData.location || '',
                category: bookmarkData.category || 'general',
                url: bookmarkData.url || '',
                createdAt: timestamp,
                memory: `User saved bookmark: "${bookmarkData.title}" - ${bookmarkData.description}${bookmarkData.location ? ` (Location: ${bookmarkData.location})` : ''}${bookmarkData.url ? ` (URL: ${bookmarkData.url})` : ''}`
            };
            const userBookmarksFile = path.join(this.BOOKMARKS_DIR, `${userId}.json`);
            console.log(`📁 File Storage - Target file: ${userBookmarksFile}`);
            let existingBookmarks = [];
            try {
                if (fsSync.existsSync(userBookmarksFile)) {
                    console.log(`📁 File Storage - Reading existing file`);
                    const fileContent = await fs.readFile(userBookmarksFile, 'utf8');
                    existingBookmarks = JSON.parse(fileContent);
                    console.log(`📁 File Storage - Found ${existingBookmarks.length} existing bookmarks`);
                }
                else {
                    console.log(`📁 File Storage - Creating new bookmark file`);
                }
            }
            catch (readError) {
                console.error(`📁 File Storage - Error reading existing file: ${readError.message}`);
                existingBookmarks = [];
            }
            existingBookmarks.push(bookmark);
            console.log(`📁 File Storage - Adding bookmark, total will be: ${existingBookmarks.length}`);
            await fs.writeFile(userBookmarksFile, JSON.stringify(existingBookmarks, null, 2), 'utf8');
            this.logger.log(`✅ Bookmark saved to file: ${bookmarkId}`);
            console.log(`✅ File Storage - Bookmark saved successfully:`, {
                id: bookmarkId,
                title: bookmark.title,
                filePath: userBookmarksFile
            });
            return bookmarkId;
        }
        catch (error) {
            this.logger.error(`❌ Error saving bookmark to file: ${error.message}`);
            console.error(`❌ File Storage - Save error:`, error);
            return null;
        }
    }
    async getBookmarksFromFile(userId) {
        try {
            const userBookmarksFile = path.join(this.BOOKMARKS_DIR, `${userId}.json`);
            console.log(`📁 File Storage - Looking for file: ${userBookmarksFile}`);
            if (!fsSync.existsSync(userBookmarksFile)) {
                console.log(`📁 No bookmark file found for user: ${userId}`);
                return [];
            }
            console.log(`📁 File Storage - Reading bookmark file`);
            const fileContent = await fs.readFile(userBookmarksFile, 'utf8');
            const bookmarks = JSON.parse(fileContent);
            const memoryResults = bookmarks.map(bookmark => ({
                id: bookmark.id,
                memory: bookmark.memory,
                score: 1.0,
            }));
            this.logger.log(`📚 Retrieved ${memoryResults.length} bookmarks from file`);
            console.log(`📚 File Storage - Retrieved bookmarks:`, memoryResults.length, 'items');
            return memoryResults;
        }
        catch (error) {
            this.logger.error(`❌ Error reading bookmarks from file: ${error.message}`);
            console.error(`❌ File Storage - Read error:`, error);
            return [];
        }
    }
    async queryMemory(query, userId) {
        try {
            this.logger.log(`🔍 Querying memory: "${query}" for user: ${userId}`);
            console.log(`🔍 Memory Service - Query:`, { query, userId });
            const response = await this.memory.search(query, { user_id: userId });
            let resultMemories = [];
            if (Array.isArray(response)) {
                resultMemories = response.map(item => ({
                    id: item.id || '',
                    memory: item.memory || '',
                    score: item.score || 0,
                }));
            }
            this.logger.log(`🔍 Query returned ${resultMemories.length} results`);
            console.log(`🔍 Memory Service - Query results:`, resultMemories);
            return resultMemories;
        }
        catch (error) {
            this.logger.error(`❌ Error querying memory: ${error.message}`);
            console.error(`❌ Memory Service - Query error:`, error);
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