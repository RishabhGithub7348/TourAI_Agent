"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const voice_gateway_1 = require("./gateways/voice.gateway");
const gemini_service_1 = require("./services/gemini.service");
const memory_service_1 = require("./services/memory.service");
const pinecone_service_1 = require("./services/pinecone.service");
const tools_service_1 = require("./services/tools.service");
const config_service_1 = require("./config/config.service");
const test_controller_1 = require("./controllers/test.controller");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: '.env',
            }),
        ],
        controllers: [test_controller_1.TestController],
        providers: [
            config_service_1.AppConfigService,
            pinecone_service_1.PineconeService,
            memory_service_1.MemoryService,
            tools_service_1.ToolsService,
            gemini_service_1.GeminiService,
            voice_gateway_1.VoiceGateway,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map