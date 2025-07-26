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
var PineconeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PineconeService = void 0;
const common_1 = require("@nestjs/common");
const pinecone_1 = require("@pinecone-database/pinecone");
const config_service_1 = require("../config/config.service");
const openai_1 = require("openai");
let PineconeService = PineconeService_1 = class PineconeService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(PineconeService_1.name);
        this.pinecone = null;
        this.indexName = this.configService.pineconeIndexName;
        const openaiApiKey = this.configService.openaiApiKey;
        if (!openaiApiKey) {
            this.logger.warn('OpenAI API key not provided, embeddings will fail');
        }
        this.openai = new openai_1.OpenAI({
            apiKey: openaiApiKey,
        });
        this.initializePinecone();
    }
    async initializePinecone() {
        try {
            const apiKey = this.configService.pineconeApiKey;
            if (!apiKey) {
                this.logger.warn('Pinecone API key not provided, bookmark storage will use file fallback');
                return;
            }
            this.pinecone = new pinecone_1.Pinecone({
                apiKey: apiKey,
            });
            this.logger.log('✅ Pinecone initialized successfully');
            await this.ensureIndexExists();
        }
        catch (error) {
            this.logger.error(`❌ Failed to initialize Pinecone: ${error.message}`);
            this.pinecone = null;
        }
    }
    async ensureIndexExists() {
        try {
            if (!this.pinecone)
                return;
            const indexes = await this.pinecone.listIndexes();
            const indexExists = indexes.indexes?.some(index => index.name === this.indexName);
            if (!indexExists) {
                this.logger.log(`🏗️ Creating Pinecone index: ${this.indexName}`);
                await this.pinecone.createIndex({
                    name: this.indexName,
                    dimension: 1536,
                    metric: 'cosine',
                    spec: {
                        serverless: {
                            cloud: 'aws',
                            region: 'us-east-1'
                        }
                    }
                });
                this.logger.log(`✅ Index ${this.indexName} created successfully`);
            }
            else {
                this.logger.log(`✅ Index ${this.indexName} already exists`);
            }
        }
        catch (error) {
            this.logger.error(`❌ Error ensuring index exists: ${error.message}`);
        }
    }
    async createEmbedding(text) {
        try {
            if (!this.configService.openaiApiKey) {
                throw new Error('OpenAI API key not configured');
            }
            const response = await this.openai.embeddings.create({
                model: 'text-embedding-3-small',
                input: text,
                encoding_format: 'float',
            });
            if (!response.data?.[0]?.embedding) {
                throw new Error('Invalid embedding response from OpenAI');
            }
            this.logger.debug(`✅ Created embedding for text: ${text.substring(0, 50)}...`);
            return response.data[0].embedding;
        }
        catch (error) {
            this.logger.error(`❌ Error creating OpenAI embedding: ${error.message}`);
            throw error;
        }
    }
    async saveBookmark(content, userId, metadata) {
        try {
            if (!this.pinecone) {
                this.logger.warn('Pinecone not available, falling back to file storage');
                return null;
            }
            const embedding = await this.createEmbedding(content);
            const bookmarkId = `bookmark_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const bookmarkMetadata = {
                userId,
                timestamp: Date.now(),
                title: metadata.title,
                description: metadata.description,
                category: metadata.category,
                location: metadata.location,
                url: metadata.url
            };
            const vector = {
                id: bookmarkId,
                values: embedding,
                metadata: bookmarkMetadata
            };
            const index = this.pinecone.index(this.indexName);
            await index.upsert([vector]);
            this.logger.log(`✅ Bookmark saved to Pinecone: ${bookmarkId}`);
            console.log(`📌 PineconeService - Bookmark saved:`, {
                id: bookmarkId,
                title: metadata.title,
                category: metadata.category,
                userId
            });
            return bookmarkId;
        }
        catch (error) {
            this.logger.error(`❌ Error saving bookmark to Pinecone: ${error.message}`);
            console.error(`❌ PineconeService - Save error:`, error);
            return null;
        }
    }
    async getBookmarks(userId, query, limit = 50) {
        try {
            if (!this.pinecone) {
                this.logger.warn('Pinecone not available');
                return [];
            }
            const index = this.pinecone.index(this.indexName);
            if (query) {
                const queryEmbedding = await this.createEmbedding(query);
                const queryResponse = await index.query({
                    vector: queryEmbedding,
                    filter: { userId: { $eq: userId } },
                    topK: limit,
                    includeMetadata: true
                });
                const bookmarks = queryResponse.matches
                    ?.filter(match => match.metadata)
                    .map(match => match.metadata) || [];
                this.logger.log(`🔍 Found ${bookmarks.length} bookmarks for semantic query: "${query}"`);
                return bookmarks;
            }
            else {
                const dummyEmbedding = await this.createEmbedding('travel bookmark memory');
                const queryResponse = await index.query({
                    vector: dummyEmbedding,
                    filter: { userId: { $eq: userId } },
                    topK: limit,
                    includeMetadata: true
                });
                const bookmarks = queryResponse.matches
                    ?.filter(match => match.metadata)
                    .map(match => match.metadata)
                    .sort((a, b) => b.timestamp - a.timestamp) || [];
                this.logger.log(`📚 Found ${bookmarks.length} total bookmarks for user: ${userId}`);
                return bookmarks;
            }
        }
        catch (error) {
            this.logger.error(`❌ Error retrieving bookmarks from Pinecone: ${error.message}`);
            console.error(`❌ PineconeService - Retrieval error:`, error);
            return [];
        }
    }
    async searchBookmarks(userId, query, limit = 10) {
        return this.getBookmarks(userId, query, limit);
    }
    async deleteBookmark(bookmarkId) {
        try {
            if (!this.pinecone) {
                this.logger.warn('Pinecone not available');
                return false;
            }
            const index = this.pinecone.index(this.indexName);
            await index.deleteOne(bookmarkId);
            this.logger.log(`🗑️ Bookmark deleted: ${bookmarkId}`);
            return true;
        }
        catch (error) {
            this.logger.error(`❌ Error deleting bookmark: ${error.message}`);
            return false;
        }
    }
    isAvailable() {
        return this.pinecone !== null;
    }
};
exports.PineconeService = PineconeService;
exports.PineconeService = PineconeService = PineconeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.AppConfigService])
], PineconeService);
//# sourceMappingURL=pinecone.service.js.map