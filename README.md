# 🚀 RAG Scientific - Backend API

<div align="center">

![NestJS](https://img.shields.io/badge/NestJS-10.x-E0234E.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-12+-336791.svg)
![Prisma](https://img.shields.io/badge/Prisma-6.x-2D3748.svg)

**Backend API for RAG Scientific - AI-Powered Research Paper Analysis**

[Quick Start](#-quick-start) • [Features](#-features) • [API Endpoints](#-api-endpoints)

</div>

---

## 📋 Overview

NestJS Backend API với các tính năng:

- User authentication (Email/Password + Google OAuth)
- Paper management (upload PDF, organize với folders)
- AI Chat với RAG integration
- PDF highlighting & comments
- Email service (password reset)

## ✨ Features

- 🔐 JWT Authentication (Access/Refresh tokens)
- 🔑 Google OAuth 2.0
- 📄 Paper upload & management (AWS S3)
- 💬 AI Chat (single/multi-paper Q&A)
- 🤝 Collaborative Sessions (real-time multi-user chat)
- ✏️ PDF highlighting & comments
- 💬 Message reactions & threaded replies
- 📧 Password reset email (Resend)
- 🎯 Guest mode (24h TTL auto-cleanup)
- 📖 Swagger API documentation
- 🗃️ Prisma ORM (type-safe database)
- 🔌 WebSocket support (real-time updates)

## 📋 Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0
- PostgreSQL >= 12.0

## ⚡ Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp .env.example .env
# Sửa JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, DATABASE_URL trong .env

# 3. Setup database
npm run prisma:generate
npm run prisma:migrate

# 4. Start dev server
npm run start:dev
```

**Truy cập:**

- API: http://localhost:3000
- Swagger: http://localhost:3000/api

## 🚀 Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Tạo file `.env`:

```bash
cp .env.example .env
```

File `.env` cần có:

```env
# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=rag_scientific
POSTGRES_PORT=5432

DATABASE_URL="postgresql://user:password@localhost:5432/rag_scientific?schema=public"

# JWT (REQUIRED - Generate với: openssl rand -base64 32)
JWT_ACCESS_SECRET="your-access-secret-here"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="your-refresh-secret-here"
JWT_REFRESH_EXPIRES_IN="7d"

# Google OAuth (Optional)
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# RAG Service (Python FastAPI)
RAG_SERVICE_URL="http://localhost:8000"

# Email (Resend)
RESEND_API_KEY="re_your_resend_api_key"
EMAIL_FROM="noreply@yourdomain.com"

# Frontend URL
FRONTEND_URL="http://localhost:5173"

# AWS S3
AWS_REGION="ap-southeast-1"
AWS_S3_BUCKET="your-bucket-name"
AWS_ACCESS_KEY_ID="your-aws-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret"

# App Config
PORT=3000
NODE_ENV=development
CORS_ORIGINS="http://localhost:5173"
GUEST_FILE_TTL_HOURS="24"
```

**Quan trọng:**

- Generate JWT secrets: `openssl rand -base64 32`
- Tạo database PostgreSQL: `rag_scientific`
- Cấu hình AWS S3 bucket cho file upload
- Resend API key cho email (password reset)

### 3. Setup PostgreSQL Database

#### Option 1: Manual Setup

Tạo database `rag_scientific` trong PostgreSQL của bạn, sau đó update `DATABASE_URL` trong `.env`.

#### Option 2: Using Docker Compose

Nếu bạn chưa có PostgreSQL, có thể sử dụng Docker Compose để setup database:

```bash
# Tạo file docker-compose.yml trong thư mục gốc
# Nội dung file docker-compose.yml:
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: rag_scientific
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

```bash
# Chạy database
docker-compose up -d

# DATABASE_URL trong .env sẽ là:
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rag_scientific?schema=public"
```

### 4. Prisma Migration

```bash
# Generate Prisma Client
npm run prisma:generate

# Chạy migrations (tạo tables trong database)
npm run prisma:migrate
```

**Prisma Commands:**

| Command                     | Mục đích                                  |
| --------------------------- | ----------------------------------------- |
| `npm run prisma:generate`   | Generate Prisma Client (TypeScript types) |
| `npm run prisma:migrate`    | Tạo và apply migration mới                |
| `npx prisma migrate dev`    | Development: tạo migration với tên        |
| `npx prisma migrate reset`  | Reset DB (⚠️ xóa hết data)                |
| `npm run prisma:studio`     | Mở Prisma Studio (GUI)                    |
| `npx prisma migrate status` | Xem trạng thái migrations                 |

**Workflow khi sửa schema:**

```bash
# 1. Sửa file prisma/schema.prisma

# 2. Tạo migration mới
npx prisma migrate dev --name ten_migration

# 3. Prisma Client tự động regenerate
```

### 5. Run Development Server

```bash
npm run start:dev
```

Server chạy tại: http://localhost:3000

## 📚 Swagger API Docs

Truy cập: http://localhost:3000/api

**Cách dùng:**

1. Đăng nhập để lấy token
2. Click "Authorize" → nhập `Bearer <token>`
3. Test API trực tiếp trên browser

## 🧪 Testing

```bash
npm run test           # Unit tests
npm run test:e2e       # E2E tests
npm run test:cov       # Coverage
```

## 📁 Cấu trúc dự án

```
rag-scientific-be/
├── prisma/
│   ├── schema.prisma           # Database schema definition
│   └── migrations/             # Database migrations
├── docs/
│   ├── DATABASE_SCHEMA.md      # Database documentation
│   └── ARCHITECTURE.md         # Architecture & design docs
├── src/
│   ├── auth/                   # 🔐 Authentication module
│   │   ├── dto/               # Login, Signup, OAuth DTOs
│   │   ├── auth.controller.ts # Login, Signup, Google OAuth, Refresh
│   │   ├── auth.service.ts    # JWT generation, password hashing
│   │   ├── jwt.strategy.ts    # Passport JWT strategy
│   │   └── jwt-auth.guard.ts  # Route protection guard
│   │
│   ├── paper/                  # 📄 Paper management
│   │   ├── dto/               # Create, Update, Delete DTOs
│   │   ├── paper.controller.ts
│   │   └── paper.service.ts   # CRUD + RAG integration
│   │
│   ├── chat/                   # 💬 AI Chat module
│   │   ├── dto/               # Ask question, Multi-paper DTOs
│   │   ├── chat.controller.ts
│   │   └── chat.service.ts    # RAG query, message history, reactions
│   │
│   ├── conversation/           # 🗣️ Conversation management
│   │   ├── dto/
│   │   ├── conversation.controller.ts
│   │   └── conversation.service.ts
│   │
│   ├── session/                # 🤝 Collaborative sessions
│   │   ├── dto/
│   │   ├── session.controller.ts
│   │   ├── session.service.ts
│   │   └── session.gateway.ts # WebSocket gateway for real-time
│   │
│   ├── upload/                 # ☁️ File upload (S3)
│   │   ├── dto/
│   │   ├── upload.controller.ts
│   │   ├── upload.service.ts
│   │   └── s3.service.ts      # AWS S3 integration
│   │
│   ├── guest/                  # 👤 Guest mode (no auth)
│   │   ├── dto/
│   │   ├── guest.controller.ts
│   │   └── guest.service.ts
│   │
│   ├── highlight/              # ✏️ PDF highlighting & annotations
│   │   ├── dto/               # Highlight, Comment DTOs
│   │   ├── highlight.controller.ts
│   │   ├── highlight.service.ts
│   │   ├── comment.controller.ts
│   │   └── comment.service.ts # Comment CRUD
│   │
│   ├── users/                  # 👥 User management
│   │   ├── users.service.ts
│   │   └── users.module.ts
│   │
│   ├── email/                  # 📧 Email service (password reset)
│   │   ├── email.service.ts
│   │   ├── email.module.ts
│   │   ├── providers/         # Resend provider
│   │   ├── templates/         # Email templates
│   │   └── interfaces/
│   │
│   ├── cleanup/                # 🧹 Background cleanup service
│   │   ├── cleanup.service.ts # Auto-delete guest files (24h TTL)
│   │   └── cleanup.module.ts
│   │
│   ├── rag/                    # 🤖 RAG service integration
│   │   ├── rag.service.ts     # HTTP client to rag service (Pipeline_RAG)
│   │   ├── rag.module.ts
│   │   └── dto/
│   │
│   ├── prisma/                 # 🗃️ Database access
│   │   ├── prisma.service.ts
│   │   └── prisma.module.ts
│   │
│   ├── common/                 # 🔧 Shared utilities
│   │   ├── dto/               # ApiResponseDto
│   │   ├── decorators/        # @CurrentUser decorator
│   │   └── constants/         # App-wide constants
│   │
│   ├── app.module.ts           # Root module
│   └── main.ts                 # Application entry point
│
├── test/                       # E2E tests
└── package.json
```

## 🔐 API Endpoints

### Authentication (`/auth`)

| Method | Endpoint                | Description                  | Auth |
| ------ | ----------------------- | ---------------------------- | ---- |
| `POST` | `/auth/signup`          | Đăng ký tài khoản mới        | ❌   |
| `POST` | `/auth/login`           | Đăng nhập (email/password)   | ❌   |
| `POST` | `/auth/google`          | Đăng nhập Google (ID Token)  | ❌   |
| `POST` | `/auth/google/code`     | Đăng nhập Google (Auth Code) | ❌   |
| `POST` | `/auth/refresh`         | Refresh access token         | ❌   |
| `POST` | `/auth/logout`          | Đăng xuất (revoke token)     | ✅   |
| `POST` | `/auth/logout-all`      | Đăng xuất tất cả thiết bị    | ✅   |
| `POST` | `/auth/forgot-password` | Gửi email reset mật khẩu     | ❌   |
| `POST` | `/auth/reset-password`  | Reset mật khẩu với token     | ❌   |

### Papers (`/papers`)

| Method   | Endpoint                     | Description                  | Auth |
| -------- | ---------------------------- | ---------------------------- | ---- |
| `POST`   | `/papers`                    | Tạo paper mới (sau upload)   | ✅   |
| `GET`    | `/papers`                    | Danh sách papers của user    | ✅   |
| `GET`    | `/papers/:id`                | Chi tiết 1 paper             | ✅   |
| `DELETE` | `/papers/:id`                | Xóa paper                    | ✅   |
| `POST`   | `/papers/:id/summary`        | Generate paper summary (LLM) | ✅   |
| `POST`   | `/papers/:id/related-papers` | Tìm papers liên quan (arXiv) | ✅   |

### Highlights (`/papers/:paperId/highlights`, `/highlights`)

| Method   | Endpoint                      | Description                     | Auth |
| -------- | ----------------------------- | ------------------------------- | ---- |
| `POST`   | `/papers/:paperId/highlights` | Tạo highlight trên paper        | ✅   |
| `GET`    | `/papers/:paperId/highlights` | Danh sách highlights của paper  | ✅   |
| `GET`    | `/highlights/:id`             | Chi tiết 1 highlight + comments | ✅   |
| `PATCH`  | `/highlights/:id`             | Cập nhật highlight (color)      | ✅   |
| `DELETE` | `/highlights/:id`             | Xóa highlight và comments       | ✅   |

### Comments (`/highlights/:highlightId/comments`, `/comments`)

| Method   | Endpoint                            | Description                | Auth |
| -------- | ----------------------------------- | -------------------------- | ---- |
| `POST`   | `/highlights/:highlightId/comments` | Thêm comment vào highlight | ✅   |
| `GET`    | `/highlights/:highlightId/comments` | Danh sách comments         | ✅   |
| `PATCH`  | `/comments/:id`                     | Cập nhật comment           | ✅   |
| `DELETE` | `/comments/:id`                     | Xóa comment                | ✅   |

### Chat (`/chat`)

| Method   | Endpoint                         | Description                    | Auth |
| -------- | -------------------------------- | ------------------------------ | ---- |
| `POST`   | `/chat/ask`                      | Hỏi về 1 paper                 | ✅   |
| `POST`   | `/chat/send-message`             | Gửi message vào conversation   | ✅   |
| `POST`   | `/chat/ask-multi`                | Hỏi về nhiều papers            | ✅   |
| `POST`   | `/chat/explain-region`           | Giải thích vùng chọn trong PDF | ✅   |
| `GET`    | `/chat/messages/:conversationId` | Lịch sử chat                   | ✅   |
| `DELETE` | `/chat/history/:conversationId`  | Xóa lịch sử                    | ✅   |
| `POST`   | `/chat/reactions/toggle`         | Toggle reaction trên message   | ✅   |
| `POST`   | `/chat/reply`                    | Reply to specific message      | ✅   |
| `POST`   | `/chat/delete-message`           | Soft delete message            | ✅   |

### Conversations (`/conversations`)

| Method   | Endpoint                                                    | Description                    | Auth |
| -------- | ----------------------------------------------------------- | ------------------------------ | ---- |
| `POST`   | `/conversations`                                            | Tạo conversation mới           | ✅   |
| `GET`    | `/conversations`                                            | Danh sách conversations        | ✅   |
| `GET`    | `/conversations/:id`                                        | Chi tiết conversation          | ✅   |
| `DELETE` | `/conversations/:id`                                        | Xóa conversation               | ✅   |
| `POST`   | `/conversations/:id/suggested-questions`                    | Generate suggested questions   | ✅   |
| `GET`    | `/conversations/:id/suggested-questions`                    | Lấy cached suggested questions | ✅   |
| `GET`    | `/conversations/:id/messages/:messageId/followup-questions` | Get followup questions         | ✅   |

### Sessions (Collaborative) (`/sessions`)

| Method   | Endpoint                                    | Description                        | Auth |
| -------- | ------------------------------------------- | ---------------------------------- | ---- |
| `POST`   | `/sessions`                                 | Start collaborative session        | ✅   |
| `POST`   | `/sessions/join`                            | Join session via invite token      | ✅   |
| `GET`    | `/sessions`                                 | List user's collaborative sessions | ✅   |
| `GET`    | `/sessions/:conversationId`                 | Get session details & members      | ✅   |
| `POST`   | `/sessions/:conversationId/leave`           | Leave a session                    | ✅   |
| `DELETE` | `/sessions/:conversationId`                 | End session (owner only)           | ✅   |
| `GET`    | `/sessions/:conversationId/members`         | Get session members                | ✅   |
| `DELETE` | `/sessions/:conversationId/members/:userId` | Remove member (owner only)         | ✅   |
| `POST`   | `/sessions/:conversationId/invites`         | Create new invite link             | ✅   |
| `DELETE` | `/sessions/invites/:inviteToken`            | Revoke invite                      | ✅   |
| `GET`    | `/sessions/:conversationId/invites/active`  | Get active invites                 | ✅   |
| `POST`   | `/sessions/:conversationId/invites/reset`   | Reset all invites & create new one | ✅   |
| `DELETE` | `/sessions/:conversationId/invites`         | Revoke all invites                 | ✅   |

### Upload (`/upload`)

| Method | Endpoint        | Description             | Auth |
| ------ | --------------- | ----------------------- | ---- |
| `POST` | `/upload/image` | Upload image to S3      | ✅   |
| `POST` | `/upload/pdf`   | Upload single PDF to S3 | ✅   |
| `POST` | `/upload/pdfs`  | Upload multiple PDFs    | ✅   |

### Guest (`/guest`)

| Method | Endpoint                   | Description             | Auth |
| ------ | -------------------------- | ----------------------- | ---- |
| `POST` | `/guest/upload`            | Upload PDF (guest mode) | ❌   |
| `GET`  | `/guest/status/:ragFileId` | Check ingest status     | ❌   |
| `POST` | `/guest/ask`               | Hỏi về paper (guest)    | ❌   |

### Health Check

| Method | Endpoint | Description  | Auth |
| ------ | -------- | ------------ | ---- |
| `GET`  | `/`      | Health check | ❌   |

> 📖 **Swagger UI**: http://localhost:3000/api

## 🔧 Development Commands

```bash
# Development
npm run start:dev       # Dev mode với hot-reload
npm run start:debug     # Debug mode
npm run build           # Build production
npm run lint            # Lint code
npm run format          # Format code (Prettier)

# Database (Prisma)
npm run prisma:generate # Generate Prisma Client
npm run prisma:migrate  # Tạo migration mới
npm run prisma:studio   # GUI quản lý DB (http://localhost:5555)
npx prisma migrate reset # Reset DB (⚠️ xóa hết data)

# Testing
npm run test            # Unit tests
npm run test:e2e        # E2E tests
npm run test:cov        # Test coverage
```

## 📖 Database Schema

Chi tiết schema, relationships, và design decisions:

👉 **[docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md)**

## 🛠️ Tech Stack

- NestJS 10 + TypeScript 5
- PostgreSQL + Prisma ORM
- JWT + Passport.js
- Google OAuth 2.0
- AWS S3
- Resend (email)
- Swagger/OpenAPI

---

<div align="center">

Made with ❤️ using NestJS

</div>
