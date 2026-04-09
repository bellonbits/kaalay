import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix('api');

  // CORS — allow frontend dev server + mobile Capacitor
  app.enableCors({
    origin: ['http://localhost:3001', 'http://localhost:3000', 'capacitor://localhost', '*'],
    credentials: true,
  });

  // DTO validation
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.listen(process.env.PORT ?? 3000);
  console.log(`🚀 Kaalay API running on http://localhost:${process.env.PORT ?? 3000}/api`);
}
bootstrap();
