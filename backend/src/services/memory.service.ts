import { Injectable, Logger } from '@nestjs/common';
import { MemoryClient } from 'mem0ai';
import { AppConfigService } from '../config/config.service';
import { PineconeService } from './pinecone.service';
import { ConversationMessage, MemoryResult } from '../interfaces/conversation.interface';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);
  private memory: MemoryClient;
  private readonly FIXED_USER_ID = 'test_user_123';
  private readonly BOOKMARKS_DIR = path.join(process.cwd(), 'data', 'bookmarks');

  constructor(
    private configService: AppConfigService,
    private pineconeService: PineconeService
  ) {
    this.memory = new MemoryClient({ 
      apiKey: this.configService.mem0ApiKey 
    });
    
    // Ensure bookmarks directory exists
    this.ensureBookmarksDirectory();
  }

  private ensureBookmarksDirectory() {
    try {
      if (!fsSync.existsSync(this.BOOKMARKS_DIR)) {
        fsSync.mkdirSync(this.BOOKMARKS_DIR, { recursive: true });
        console.log(`📁 Created bookmarks directory: ${this.BOOKMARKS_DIR}`);
      }
    } catch (error) {
      console.error(`❌ Failed to create bookmarks directory: ${error.message}`);
    }
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

      this.logger.log(`🧠 Adding to memory: ${JSON.stringify(messages)}, user_id: ${userId}`);
      console.log(`🧠 Memory Service - Adding messages:`, messages);
      
      const result = await this.memory.add(messages, { user_id: userId, metadata: finalMetadata });
      this.logger.log(`✅ Added memory: ${JSON.stringify(result)}`);
      console.log(`✅ Memory Service - Added result:`, result);
      
      return Array.isArray(result) && result.length > 0 ? result[0]?.id || null : null;
    } catch (error) {
      this.logger.error(`❌ Error adding to memory: ${error.message}`);
      console.error(`❌ Memory Service - Error:`, error);
      return null;
    }
  }

  // Async memory addition without waiting for completion (fire-and-forget)
  addToMemoryAsync(
    messages: ConversationMessage[],
    userId: string,
    metadata?: any,
  ): void {
    const defaultMetadata = { category: 'tour_session' };
    const finalMetadata = metadata || defaultMetadata;

    this.logger.log(`Adding to memory async: ${JSON.stringify(messages)}, user_id: ${userId}`);
    
    // Fire and forget - don't await the result
    this.memory.add(messages, { user_id: userId })
      .then(result => {
        this.logger.log(`Async memory added: ${JSON.stringify(result)}`);
      })
      .catch(error => {
        this.logger.error(`Error in async memory addition: ${error.message}`);
      });
  }

  async addBookmark(
    bookmarkData: {
      title: string;
      description: string;
      location?: string;
      category?: string;
      url?: string;
    },
    userId: string,
  ): Promise<string | null> {
    try {
      const bookmarkMessage = `User saved bookmark: "${bookmarkData.title}" - ${bookmarkData.description}${bookmarkData.location ? ` (Location: ${bookmarkData.location})` : ''}${bookmarkData.url ? ` (URL: ${bookmarkData.url})` : ''}`;
      
      const metadata = { 
        category: 'bookmark',
        bookmark_title: bookmarkData.title,
        bookmark_category: bookmarkData.category || 'general',
        bookmark_location: bookmarkData.location || '',
      };

      this.logger.log(`📚 Adding bookmark to Pinecone: ${bookmarkData.title} for user: ${userId}`);
      console.log(`📚 Bookmark Service - Adding bookmark:`, bookmarkData);
      console.log(`📚 Bookmark Service - Pinecone available: ${this.pineconeService.isAvailable()}`);
      
      // Try Pinecone first
      try {
        const bookmarkId = await this.pineconeService.saveBookmark(
          bookmarkMessage, // Full content for vector embedding
          userId,
          {
            title: bookmarkData.title,
            description: bookmarkData.description,
            category: bookmarkData.category || 'general',
            location: bookmarkData.location,
            url: bookmarkData.url
          }
        );
        
        if (bookmarkId) {
          this.logger.log(`✅ Pinecone bookmark saved: ${bookmarkId}`);
          console.log(`✅ Bookmark Service - Pinecone saved with ID: ${bookmarkId}`);
          return bookmarkId;
        } else {
          throw new Error('Pinecone returned null bookmark ID');
        }
      } catch (pineconeError) {
        this.logger.error(`❌ Pinecone failed, trying file backup: ${pineconeError.message}`);
        console.error(`❌ Pinecone error details:`, pineconeError);
        
        // Fallback to file storage
        return await this.addBookmarkToFile(bookmarkData, userId);
      }
    } catch (error) {
      this.logger.error(`❌ Error saving bookmark: ${error.message}`);
      console.error(`❌ Bookmark Service - Error:`, error);
      
      // Try file backup as last resort
      try {
        return await this.addBookmarkToFile(bookmarkData, userId);
      } catch (fileError) {
        console.error(`❌ File backup also failed:`, fileError);
        return null;
      }
    }
  }

  async getBookmarks(userId: string): Promise<MemoryResult[]> {
    try {
      this.logger.log(`📚 Retrieving bookmarks for user: ${userId}`);
      console.log(`📚 Bookmark Service - Getting bookmarks for user:`, userId);
      
      // Try Pinecone first
      try {
        const pineconeBookmarks = await this.pineconeService.getBookmarks(userId);
        
        // Convert Pinecone format to MemoryResult format for compatibility
        const bookmarks: MemoryResult[] = pineconeBookmarks.map(bookmark => ({
          id: `pinecone_${bookmark.timestamp}`, // Use timestamp as ID for compatibility
          memory: `User saved bookmark: "${bookmark.title}" - ${bookmark.description}${bookmark.location ? ` (Location: ${bookmark.location})` : ''}${bookmark.url ? ` (URL: ${bookmark.url})` : ''}`,
          score: 1.0 // Default score since Pinecone handles relevance differently
        }));

        this.logger.log(`📚 Retrieved ${bookmarks.length} bookmarks from Pinecone`);
        console.log(`📚 Bookmark Service - Retrieved Pinecone bookmarks:`, bookmarks.length);
        
        return bookmarks;
      } catch (pineconeError) {
        this.logger.error(`❌ Pinecone retrieval failed, trying file backup: ${pineconeError.message}`);
        
        // Fallback to file storage
        return await this.getBookmarksFromFile(userId);
      }
    } catch (error) {
      this.logger.error(`❌ Error retrieving bookmarks: ${error.message}`);
      console.error(`❌ Bookmark Service - Error:`, error);
      
      // Try file backup as last resort
      try {
        return await this.getBookmarksFromFile(userId);
      } catch (fileError) {
        console.error(`❌ File backup retrieval also failed:`, fileError);
        return [];
      }
    }
  }

  // File-based backup methods
  private async addBookmarkToFile(
    bookmarkData: {
      title: string;
      description: string;
      location?: string;
      category?: string;
      url?: string;
    },
    userId: string,
  ): Promise<string | null> {
    try {
      console.log(`📁 File Storage - Starting bookmark save for user: ${userId}`);
      
      const bookmarkId = uuidv4();
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
      
      // Check if file exists and read it
      try {
        if (fsSync.existsSync(userBookmarksFile)) {
          console.log(`📁 File Storage - Reading existing file`);
          const fileContent = await fs.readFile(userBookmarksFile, 'utf8');
          existingBookmarks = JSON.parse(fileContent);
          console.log(`📁 File Storage - Found ${existingBookmarks.length} existing bookmarks`);
        } else {
          console.log(`📁 File Storage - Creating new bookmark file`);
        }
      } catch (readError) {
        console.error(`📁 File Storage - Error reading existing file: ${readError.message}`);
        existingBookmarks = []; // Start fresh if file is corrupted
      }
      
      // Add new bookmark
      existingBookmarks.push(bookmark);
      console.log(`📁 File Storage - Adding bookmark, total will be: ${existingBookmarks.length}`);
      
      // Write file asynchronously
      await fs.writeFile(userBookmarksFile, JSON.stringify(existingBookmarks, null, 2), 'utf8');
      
      this.logger.log(`✅ Bookmark saved to file: ${bookmarkId}`);
      console.log(`✅ File Storage - Bookmark saved successfully:`, {
        id: bookmarkId,
        title: bookmark.title,
        filePath: userBookmarksFile
      });
      
      return bookmarkId;
    } catch (error) {
      this.logger.error(`❌ Error saving bookmark to file: ${error.message}`);
      console.error(`❌ File Storage - Save error:`, error);
      return null;
    }
  }

  private async getBookmarksFromFile(userId: string): Promise<MemoryResult[]> {
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
      
      const memoryResults: MemoryResult[] = bookmarks.map(bookmark => ({
        id: bookmark.id,
        memory: bookmark.memory,
        score: 1.0, // Default score for file-based bookmarks
      }));
      
      this.logger.log(`📚 Retrieved ${memoryResults.length} bookmarks from file`);
      console.log(`📚 File Storage - Retrieved bookmarks:`, memoryResults.length, 'items');
      
      return memoryResults;
    } catch (error) {
      this.logger.error(`❌ Error reading bookmarks from file: ${error.message}`);
      console.error(`❌ File Storage - Read error:`, error);
      return [];
    }
  }

  async queryMemory(query: string, userId: string): Promise<MemoryResult[]> {
    try {
      this.logger.log(`🔍 Querying memory: "${query}" for user: ${userId}`);
      console.log(`🔍 Memory Service - Query:`, { query, userId });
      
      const response = await this.memory.search(query, { user_id: userId });
      
      let resultMemories: MemoryResult[] = [];
      
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
    } catch (error) {
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
}