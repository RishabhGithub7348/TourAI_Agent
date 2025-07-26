import { MemoryService } from '../services/memory.service';
import { ToolsService } from '../services/tools.service';
export declare class TestController {
    private memoryService;
    private toolsService;
    constructor(memoryService: MemoryService, toolsService: ToolsService);
    testBookmark(body: {
        content: string;
        userId?: string;
    }): Promise<{
        success: boolean;
        result: string;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        result?: undefined;
    }>;
    testFileBookmark(body: {
        content: string;
        userId?: string;
    }): Promise<{
        success: boolean;
        result: any;
        method: string;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        result?: undefined;
        method?: undefined;
    }>;
    private extractTitle;
    testGetBookmarks(userId: string): Promise<{
        success: boolean;
        result: string;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        result?: undefined;
    }>;
}
