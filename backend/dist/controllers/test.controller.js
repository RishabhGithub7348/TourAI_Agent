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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestController = void 0;
const common_1 = require("@nestjs/common");
const memory_service_1 = require("../services/memory.service");
const tools_service_1 = require("../services/tools.service");
let TestController = class TestController {
    constructor(memoryService, toolsService) {
        this.memoryService = memoryService;
        this.toolsService = toolsService;
    }
    async testBookmark(body) {
        console.log('🧪 Test Controller - Testing bookmark save:', body);
        try {
            const result = await this.toolsService.saveBookmark(body.content, undefined, undefined, body.userId || 'test_user_manual');
            console.log('🧪 Test Controller - Bookmark result:', result);
            return { success: true, result };
        }
        catch (error) {
            console.error('🧪 Test Controller - Bookmark error:', error);
            return { success: false, error: error.message };
        }
    }
    async testFileBookmark(body) {
        console.log('🧪 Test Controller - Testing FILE-ONLY bookmark save:', body);
        try {
            const bookmarkData = {
                title: this.extractTitle(body.content),
                description: body.content,
                location: '',
                category: 'test',
                url: ''
            };
            const result = await this.memoryService.addBookmarkToFile(bookmarkData, body.userId || 'test_user_file_direct');
            console.log('🧪 Test Controller - File bookmark result:', result);
            return { success: true, result, method: 'file-storage-only' };
        }
        catch (error) {
            console.error('🧪 Test Controller - File bookmark error:', error);
            return { success: false, error: error.message };
        }
    }
    extractTitle(content) {
        const words = content.split(' ');
        if (words.length <= 8) {
            return content;
        }
        return words.slice(0, 8).join(' ') + '...';
    }
    async testGetBookmarks(userId) {
        console.log('🧪 Test Controller - Getting bookmarks for:', userId);
        try {
            const result = await this.toolsService.getBookmarks(userId);
            console.log('🧪 Test Controller - Get bookmarks result:', result);
            return { success: true, result };
        }
        catch (error) {
            console.error('🧪 Test Controller - Get bookmarks error:', error);
            return { success: false, error: error.message };
        }
    }
};
exports.TestController = TestController;
__decorate([
    (0, common_1.Post)('bookmark'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TestController.prototype, "testBookmark", null);
__decorate([
    (0, common_1.Post)('bookmark/file-only'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TestController.prototype, "testFileBookmark", null);
__decorate([
    (0, common_1.Get)('bookmarks/:userId'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TestController.prototype, "testGetBookmarks", null);
exports.TestController = TestController = __decorate([
    (0, common_1.Controller)('test'),
    __metadata("design:paramtypes", [memory_service_1.MemoryService,
        tools_service_1.ToolsService])
], TestController);
//# sourceMappingURL=test.controller.js.map