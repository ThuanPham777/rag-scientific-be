import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Increase body size limit for large payloads (e.g., base64 images)
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  const corsOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // allow non-browser tools (Postman, curl) or same-origin
      if (!origin) return callback(null, true);

      // nếu chưa cấu hình env thì cho phép localhost dev
      if (corsOrigins.length === 0) {
        const isLocal = /^http:\/\/localhost:\d+$/.test(origin);
        return callback(null, isLocal);
      }

      if (corsOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: true, // bật nếu bạn dùng cookie/refresh token qua cookie
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger API Documentation Configuration
  const config = new DocumentBuilder()
    .setTitle('RAG Scientific API')
    .setDescription(
      `
# RAG Scientific Backend API

A comprehensive REST API for the RAG (Retrieval-Augmented Generation) Scientific Paper Analysis platform.

## Features

### 🔐 Authentication & Authorization
- **Local Registration/Login** - Email and password authentication
- **Google OAuth 2.0** - Support for both ID token and Authorization Code flows
- **JWT-based Sessions** - Secure access tokens with refresh token rotation
- **Multi-device Management** - Track and manage sessions across devices

### 📄 Document Management
- **PDF Upload & Processing** - Upload scientific papers for AI analysis
- **Folder Organization** - Organize papers in custom folders
- **Guest Upload** - Allow anonymous users to upload and analyze papers temporarily

### 💬 AI-Powered Chat
- **Single Paper Analysis** - Ask questions about individual papers
- **Multi-Paper Queries** - Compare and analyze multiple papers simultaneously
- **Region Explanation** - Select and analyze specific regions/figures in PDFs
- **Citation Tracking** - Get precise citations and references for AI responses

### 🔍 Advanced Features
- **Conversation Management** - Maintain chat history and context
- **Highlight & Comments** - Annotate papers with highlights and notes
- **Vector Search** - AI-powered semantic search across document content
- **Auto-cleanup** - Automated management of temporary and orphaned files

## Authentication

Most endpoints require authentication. Include your JWT access token in the Authorization header:

\`\`\`
Authorization: Bearer <your-access-token>
\`\`\`

Access tokens expire after ~15 minutes. Use the refresh token endpoint to obtain new tokens without re-login.

## Rate Limits

- **File Upload:** 50MB max file size
- **API Requests:** Standard rate limiting applies
- **Guest Users:** Limited to temporary uploads (auto-cleanup after 24 hours)

## Error Handling

All endpoints return consistent error responses with appropriate HTTP status codes and descriptive messages.
    `,
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description:
          'Enter your JWT access token. Get this from login/signup endpoints.',
        in: 'header',
      },
      'JWT-auth', // This name matches @ApiBearerAuth('JWT-auth') in controllers
    )
    .addTag('auth', 'Authentication and user management')
    .addTag('papers', 'PDF document upload and management')
    .addTag('chat', 'AI-powered conversations about papers')
    .addTag('folders', 'Organization and folder management')
    .addTag('conversations', 'Chat history and conversation management')
    .addTag('upload', 'File upload utilities')
    .addTag('guest', 'Guest user functionality (temporary access)')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`🚀 Application running on: http://localhost:${port}`);
  logger.log(`📚 Swagger docs: http://localhost:${port}/docs`);
}
bootstrap();
