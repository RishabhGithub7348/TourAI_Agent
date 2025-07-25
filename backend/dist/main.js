"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const globalPrefix = 'api';
    app.setGlobalPrefix(globalPrefix);
    app.enableCors({
        origin: '*',
        credentials: true,
    });
    const port = process.env.PORT || 5000;
    const logger = new common_1.Logger('Bootstrap');
    await app.listen(port);
    logger.log(`🚀 Application is running on: http://localhost:${port}/${globalPrefix}`);
    logger.log(`🔊 WebSocket server running on port 9084`);
    logger.log(`📝 Long memory tutoring assistant ready to help`);
}
bootstrap().catch((error) => {
    console.error('Error starting the application:', error);
    process.exit(1);
});
//# sourceMappingURL=main.js.map