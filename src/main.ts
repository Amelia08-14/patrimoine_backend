import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  console.log('Starting NestJS...');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  console.log('App created');

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // Strips properties that are not in the DTO
    transform: true, // Automatically transforms payloads to DTO instances
  }));
  
  // Activer CORS pour autoriser le frontend
  app.enableCors({
    origin: true, // Autorise toutes les origines en développement
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 8000);
  console.log('Listening on 8000');
}
bootstrap();
