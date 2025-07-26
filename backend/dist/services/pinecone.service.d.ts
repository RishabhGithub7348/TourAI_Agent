import { AppConfigService } from '../config/config.service';
interface BookmarkMetadata {
    userId: string;
    title: string;
    description: string;
    category: string;
    location?: string;
    timestamp: number;
    url?: string;
    [key: string]: any;
}
export declare class PineconeService {
    private configService;
    private readonly logger;
    private pinecone;
    private openai;
    private indexName;
    constructor(configService: AppConfigService);
    private initializePinecone;
    private ensureIndexExists;
    private createEmbedding;
    saveBookmark(content: string, userId: string, metadata: Omit<BookmarkMetadata, 'userId' | 'timestamp'>): Promise<string | null>;
    getBookmarks(userId: string, query?: string, limit?: number): Promise<BookmarkMetadata[]>;
    searchBookmarks(userId: string, query: string, limit?: number): Promise<BookmarkMetadata[]>;
    deleteBookmark(bookmarkId: string): Promise<boolean>;
    isAvailable(): boolean;
}
export {};
