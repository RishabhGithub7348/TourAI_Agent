import { Injectable, Logger } from '@nestjs/common';
import { Pinecone } from '@pinecone-database/pinecone';
import { AppConfigService } from '../config/config.service';
import { OpenAI } from 'openai';

interface BookmarkMetadata {
  userId: string;
  title: string;
  description: string;
  category: string;
  location?: string;
  timestamp: number;
  url?: string;
  [key: string]: any; // Index signature for Pinecone compatibility
}

interface BookmarkVector {
  id: string;
  values: number[];
  metadata: BookmarkMetadata;
}

@Injectable()
export class PineconeService {
  private readonly logger = new Logger(PineconeService.name);
  private pinecone: Pinecone | null = null;
  private openai: OpenAI;
  private indexName: string;

  constructor(private configService: AppConfigService) {
    this.indexName = this.configService.pineconeIndexName;
    
    const openaiApiKey = this.configService.openaiApiKey;
    if (!openaiApiKey) {
      this.logger.warn('OpenAI API key not provided, embeddings will fail');
    }
    
    this.openai = new OpenAI({
      apiKey: openaiApiKey,
    });
    this.initializePinecone();
  }

  private async initializePinecone() {
    try {
      const apiKey = this.configService.pineconeApiKey;
      if (!apiKey) {
        this.logger.warn('Pinecone API key not provided, bookmark storage will use file fallback');
        return;
      }

      this.pinecone = new Pinecone({
        apiKey: apiKey,
      });

      this.logger.log('✅ Pinecone initialized successfully');
      
      // Check if index exists, create if not
      await this.ensureIndexExists();
    } catch (error) {
      this.logger.error(`❌ Failed to initialize Pinecone: ${error.message}`);
      this.pinecone = null;
    }
  }

  private async ensureIndexExists() {
    try {
      if (!this.pinecone) return;

      const indexes = await this.pinecone.listIndexes();
      const indexExists = indexes.indexes?.some(index => index.name === this.indexName);

      if (!indexExists) {
        this.logger.log(`🏗️ Creating Pinecone index: ${this.indexName}`);
        await this.pinecone.createIndex({
          name: this.indexName,
          dimension: 1536, // OpenAI's text-embedding-3-small dimension
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-east-1'
            }
          }
        });
        this.logger.log(`✅ Index ${this.indexName} created successfully`);
      } else {
        this.logger.log(`✅ Index ${this.indexName} already exists`);
      }
    } catch (error) {
      this.logger.error(`❌ Error ensuring index exists: ${error.message}`);
    }
  }

  // Create vector embedding using OpenAI's embedding API
  private async createEmbedding(text: string): Promise<number[]> {
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
    } catch (error) {
      this.logger.error(`❌ Error creating OpenAI embedding: ${error.message}`);
      throw error;
    }
  }

  // Save bookmark as vector in Pinecone
  async saveBookmark(
    content: string,
    userId: string,
    metadata: Omit<BookmarkMetadata, 'userId' | 'timestamp'>
  ): Promise<string | null> {
    try {
      if (!this.pinecone) {
        this.logger.warn('Pinecone not available, falling back to file storage');
        return null;
      }

      // Create embedding for the content
      const embedding = await this.createEmbedding(content);
      
      // Generate unique ID
      const bookmarkId = `bookmark_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Prepare vector data
      const bookmarkMetadata: BookmarkMetadata = {
        userId,
        timestamp: Date.now(),
        title: metadata.title,
        description: metadata.description,
        category: metadata.category,
        location: metadata.location,
        url: metadata.url
      };
      
      const vector: BookmarkVector = {
        id: bookmarkId,
        values: embedding,
        metadata: bookmarkMetadata
      };

      // Get index and upsert vector
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
    } catch (error) {
      this.logger.error(`❌ Error saving bookmark to Pinecone: ${error.message}`);
      console.error(`❌ PineconeService - Save error:`, error);
      return null;
    }
  }

  // Retrieve bookmarks for a user using semantic search
  async getBookmarks(
    userId: string,
    query?: string,
    limit: number = 50
  ): Promise<BookmarkMetadata[]> {
    try {
      if (!this.pinecone) {
        this.logger.warn('Pinecone not available');
        return [];
      }

      const index = this.pinecone.index(this.indexName);
      
      if (query) {
        // Semantic search using query embedding
        const queryEmbedding = await this.createEmbedding(query);
        
        const queryResponse = await index.query({
          vector: queryEmbedding,
          filter: { userId: { $eq: userId } },
          topK: limit,
          includeMetadata: true
        });

        const bookmarks = queryResponse.matches
          ?.filter(match => match.metadata)
          .map(match => match.metadata as unknown as BookmarkMetadata) || [];

        this.logger.log(`🔍 Found ${bookmarks.length} bookmarks for semantic query: "${query}"`);
        return bookmarks;
      } else {
        // Get all bookmarks for user (no semantic search)
        // We'll use a dummy query and high limit, then filter by score
        const dummyEmbedding = await this.createEmbedding('travel bookmark memory');
        
        const queryResponse = await index.query({
          vector: dummyEmbedding,
          filter: { userId: { $eq: userId } },
          topK: limit,
          includeMetadata: true
        });

        const bookmarks = queryResponse.matches
          ?.filter(match => match.metadata)
          .map(match => match.metadata as unknown as BookmarkMetadata)
          .sort((a, b) => b.timestamp - a.timestamp) || []; // Sort by timestamp

        this.logger.log(`📚 Found ${bookmarks.length} total bookmarks for user: ${userId}`);
        return bookmarks;
      }
    } catch (error) {
      this.logger.error(`❌ Error retrieving bookmarks from Pinecone: ${error.message}`);
      console.error(`❌ PineconeService - Retrieval error:`, error);
      return [];
    }
  }

  // Search bookmarks semantically
  async searchBookmarks(
    userId: string,
    query: string,
    limit: number = 10
  ): Promise<BookmarkMetadata[]> {
    return this.getBookmarks(userId, query, limit);
  }

  // Delete a bookmark
  async deleteBookmark(bookmarkId: string): Promise<boolean> {
    try {
      if (!this.pinecone) {
        this.logger.warn('Pinecone not available');
        return false;
      }

      const index = this.pinecone.index(this.indexName);
      await index.deleteOne(bookmarkId);

      this.logger.log(`🗑️ Bookmark deleted: ${bookmarkId}`);
      return true;
    } catch (error) {
      this.logger.error(`❌ Error deleting bookmark: ${error.message}`);
      return false;
    }
  }

  // Check if Pinecone is available
  isAvailable(): boolean {
    return this.pinecone !== null;
  }
}