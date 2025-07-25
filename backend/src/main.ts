import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  app.enableCors({
    origin: '*',
    credentials: true,
  });

  const port = process.env.PORT || 5000;
  const logger = new Logger('Bootstrap');

  await app.listen(port);
  
  logger.log(`🚀 Application is running on: http://localhost:${port}/${globalPrefix}`);
  logger.log(`🔊 WebSocket server running on port 9084`);
  logger.log(`📝 Long memory tutoring assistant ready to help`);
}

bootstrap().catch((error) => {
  console.error('Error starting the application:', error);
  process.exit(1);
});