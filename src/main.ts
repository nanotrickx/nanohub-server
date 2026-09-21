import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { WsAdapter } from '@nestjs/platform-ws';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 8080);
  const corsOrigin = configService.get<string>('app.corsOrigin', '*');

  // WebSocket Adapter (RFC 6455 over /ws)
  app.useWebSocketAdapter(new WsAdapter(app));

  // Global Cross-Origin Resource Sharing (CORS)
  app.enableCors({
    origin: corsOrigin === '*' ? true : corsOrigin,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization, X-Requested-With',
    credentials: true,
  });

  // Global Validation & Serialization
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Global Filters & Interceptors
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Swagger OpenAPI Documentation
  const config = new DocumentBuilder()
    .setTitle('ESP32 Universal Home Hub & PowerGrid Gateway API')
    .setDescription(
      'Enterprise REST API and Hardware Bridge for Mains Outage Detection, Climate Telemetry, and 38 kHz NEC IR Remote Blaster',
    )
    .setVersion('2.0.0')
    .addTag('Telemetry', 'Live sensor and grid status endpoints')
    .addTag('IR Remote Blaster', 'NEC infrared transmission endpoints')
    .addTag('Hardware Bridge', 'Local hardware link configuration')
    .addTag('System & Provisioning', 'Hardware management and Wi-Fi pairing')
    .addTag('Testing & Simulation Hooks', 'Testing endpoints for grid and IR events')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'ESP32 Hub Gateway API Docs',
    customCss: '.swagger-ui .topbar { display: none }',
  });

  await app.listen(port, '0.0.0.0');

  logger.log(`=============================================================`);
  logger.log(`⚡ ESP32 Gateway Server (NestJS & TypeScript) Running`);
  logger.log(`📡 Local Endpoint:        http://localhost:${port}`);
  logger.log(`📖 Interactive API Docs:  http://localhost:${port}/api/docs`);
  logger.log(`⚡ WebSocket Stream:      ws://localhost:${port}/ws`);
  logger.log(`🔌 REST Status API:       http://localhost:${port}/api/status`);
  logger.log(`=============================================================`);
}
bootstrap();
