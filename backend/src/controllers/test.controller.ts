import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { MemoryService } from '../services/memory.service';
import { ToolsService } from '../services/tools.service';

@Controller('test')
export class TestController {
  constructor(
    private memoryService: MemoryService,
    private toolsService: ToolsService
  ) {}

  @Post('bookmark')
  async testBookmark(@Body() body: { content: string; userId?: string }) {
    console.log('🧪 Test Controller - Testing bookmark save:', body);
    
    try {
      const result = await this.toolsService.saveBookmark(
        body.content,
        undefined,
        undefined,
        body.userId || 'test_user_manual'
      );
      
      console.log('🧪 Test Controller - Bookmark result:', result);
      return { success: true, result };
    } catch (error) {
      console.error('🧪 Test Controller - Bookmark error:', error);
      return { success: false, error: error.message };
    }
  }

  @Post('bookmark/file-only')
  async testFileBookmark(@Body() body: { content: string; userId?: string }) {
    console.log('🧪 Test Controller - Testing FILE-ONLY bookmark save:', body);
    
    try {
      // Force file storage by calling the memory service directly
      const bookmarkData = {
        title: this.extractTitle(body.content),
        description: body.content,
        location: '',
        category: 'test',
        url: ''
      };
      
      // Access the private method using bracket notation (for testing only)
      const result = await (this.memoryService as any).addBookmarkToFile(
        bookmarkData,
        body.userId || 'test_user_file_direct'
      );
      
      console.log('🧪 Test Controller - File bookmark result:', result);
      return { success: true, result, method: 'file-storage-only' };
    } catch (error) {
      console.error('🧪 Test Controller - File bookmark error:', error);
      return { success: false, error: error.message };
    }
  }

  private extractTitle(content: string): string {
    const words = content.split(' ');
    if (words.length <= 8) {
      return content;
    }
    return words.slice(0, 8).join(' ') + '...';
  }

  @Get('bookmarks/:userId')
  async testGetBookmarks(@Param('userId') userId: string) {
    console.log('🧪 Test Controller - Getting bookmarks for:', userId);
    
    try {
      const result = await this.toolsService.getBookmarks(userId);
      console.log('🧪 Test Controller - Get bookmarks result:', result);
      return { success: true, result };
    } catch (error) {
      console.error('🧪 Test Controller - Get bookmarks error:', error);
      return { success: false, error: error.message };
    }
  }
}