# 🚀 RAG Scientific - Backend API

<div align="center">

![NestJS](https://img.shields.io/badge/NestJS-10.x-E0234E.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-12+-336791.svg)
![Prisma](https://img.shields.io/badge/Prisma-6.x-2D3748.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

**NestJS Backend API for RAG Scientific - AI-Powered Research Paper Analysis Platform**

[Features](#-features) • [Installation](#-installation) • [API Reference](#-api-reference) • [Architecture](#-architecture)

</div>

---

## 📋 Overview

Backend API service cho hệ thống RAG Scientific, cung cấp:

- **User Management**: Xác thực đa nền tảng (Email/Password + Google OAuth 2.0)
- **Paper Management**: Upload, organize và quản lý research papers
- **Chat System**: Real-time Q&A với AI về nội dung papers
- **Library Organization**: Folders, tags để tổ chức papers
- **RAG Integration**: Kết nối với RAG_BE_02 Python service cho AI processing

## ✨ Features

| Feature                   | Description                               |
| ------------------------- | ----------------------------------------- |
| 🔐 **JWT Authentication** | Access/Refresh token với HttpOnly cookies |
| 🔑 **Google OAuth 2.0**   | Đăng nhập nhanh qua Google                |
| 📄 **Paper Upload**       | Upload PDF lên S3, trigger RAG ingest     |
| 💬 **AI Chat**            | Single & Multi-paper Q&A với citations    |
| 📁 **Folder System**      | Organize papers trong library             |
| 🎯 **Guest Mode**         | Dùng thử không cần đăng ký                |
| 📖 **Swagger API**        | Auto-generated documentation              |
| 🗃️ **Prisma ORM**         | Type-safe database access                 |

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     NestJS Backend API                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │   Auth   │ │  Papers  │ │   Chat   │ │ Folders  │ │ Upload │ │
│  │ Module   │ │  Module  │ │  Module  │ │  Module  │ │ Module │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └───┬────┘ │
│       │            │            │            │           │      │
│       └────────────┴─────┬──────┴────────────┴───────────┘      │
│                          │                                      │
│                          ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Prisma ORM Layer                         ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
         │                                        │
         ▼                                        ▼
┌─────────────────┐                    ┌─────────────────────┐
│   PostgreSQL    │                    │   RAG_BE_02 (Python) │
│    Database     │                    │    FastAPI Service   │
└─────────────────┘                    └─────────────────────┘
                                                 │
                                                 ▼
                                       ┌─────────────────┐
                                       │  S3 / MinIO     │
                                       │  File Storage   │
                                       └─────────────────┘
```

## 📋 Prerequisites

- **Node.js**: >= 20.0.0
- **npm**: >= 10.0.0
- **PostgreSQL**: >= 12.0 (hoặc Docker Compose)
- **RAG_BE_02**: Python service đang chạy (port 8000)

## 🚀 Cài đặt

### 1. Clone repository và cài đặt dependencies

```bash
cd rag-scientific-be
npm install
```

### 2. Cấu hình Environment Variables

Tạo file `.env` ở thư mục root với nội dung:

```env
# Database Configuration (cho Docker Compose)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=rag_scientific
POSTGRES_PORT=5432

# Database Connection URL (phải khớp với các thông tin trên)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rag_scientific?schema=public"

# JWT Configuration
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
JWT_ACCESS_EXPIRES="15m"
JWT_REFRESH_EXPIRES="7d"

# Application
PORT=3000
```

**Lưu ý**:

- Thay đổi các thông tin PostgreSQL (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`) nếu cần
- Thay đổi `JWT_SECRET` bằng một chuỗi ngẫu nhiên mạnh cho production (ví dụ: dùng `openssl rand -base64 32`)
- Nếu không dùng Docker Compose, cập nhật `DATABASE_URL` theo cấu hình PostgreSQL của bạn

### 3. Cấu hình Database

#### Option 1: Sử dụng Docker Compose (Khuyên dùng)

```bash
# Khởi động PostgreSQL
docker-compose up -d

# Kiểm tra container đang chạy
docker-compose ps

# Xem logs
docker-compose logs -f postgres

# Dừng PostgreSQL
docker-compose down

# Dừng và xóa data
docker-compose down -v
```

**Lưu ý**: Đảm bảo các biến môi trường `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` trong file `.env` khớp với `DATABASE_URL`.

#### Option 2: Cài đặt PostgreSQL thủ công

1. Cài đặt PostgreSQL trên máy local
2. Tạo database: `rag_scientific`
3. Cập nhật `DATABASE_URL` trong file `.env`

### 4. Setup Prisma

```bash
# Generate Prisma Client
npm run prisma:generate

# Chạy migrations để tạo database schema
npm run prisma:migrate

# (Optional) Mở Prisma Studio để xem/quản lý data
npm run prisma:studio
```

## 🏃 Chạy ứng dụng

### Development mode (với hot-reload)

```bash
npm run start:dev
```

Ứng dụng sẽ chạy tại: `http://localhost:3000`

### Production mode

```bash
# Build ứng dụng
npm run build

# Chạy production
npm run start:prod
```

### Debug mode

```bash
npm run start:debug
```

## 📚 API Documentation (Swagger)

Sau khi chạy ứng dụng, truy cập Swagger UI tại:

```
http://localhost:3000/api
```

### Tính năng Swagger:

- ✅ Xem tất cả API endpoints
- ✅ Test API trực tiếp trên browser
- ✅ JWT Authentication tích hợp
- ✅ Schema validation và examples
- ✅ Lưu authorization token tự động

### Cách sử dụng JWT trong Swagger:

1. Đăng ký/Đăng nhập để lấy token
2. Click nút **"Authorize"** ở góc trên cùng
3. Nhập token theo format: `Bearer <your-token>`
4. Click **"Authorize"** và **"Close"**
5. Token sẽ được tự động thêm vào các request cần authentication

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov

# Watch mode
npm run test:watch
```

## 📁 Cấu trúc dự án

```
rag-scientific-be/
├── prisma/
│   ├── schema.prisma           # Database schema definition
│   └── migrations/             # Database migrations
├── docs/
│   └── DATABASE_SCHEMA.md      # Database documentation
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
│   │   └── chat.service.ts    # RAG query, message history
│   │
│   ├── conversation/           # 🗣️ Conversation management
│   │   ├── dto/
│   │   ├── conversation.controller.ts
│   │   └── conversation.service.ts
│   │
│   ├── folder/                 # 📁 Folder organization
│   │   ├── dto/
│   │   ├── folder.controller.ts
│   │   └── folder.service.ts
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
│   ├── users/                  # 👥 User management
│   │   ├── users.service.ts
│   │   └── users.module.ts
│   │
│   ├── prisma/                 # 🗃️ Database access
│   │   ├── prisma.service.ts
│   │   └── prisma.module.ts
│   │
│   ├── common/                 # 🔧 Shared utilities
│   │   ├── dto/               # ApiResponseDto
│   │   └── decorators/        # @CurrentUser decorator
│   │
│   ├── app.module.ts           # Root module
│   └── main.ts                 # Application entry point
│
├── test/                       # E2E tests
├── docker-compose.yml          # PostgreSQL container
└── package.json
```

## 🔧 Các lệnh hữu ích

### Development

```bash
npm run start:dev          # Chạy development mode với hot-reload
npm run start:debug        # Chạy debug mode
npm run build              # Build ứng dụng
npm run format             # Format code với Prettier
npm run lint               # Lint và fix code
```

### Database (Prisma)

```bash
npm run prisma:generate    # Generate Prisma Client
npm run prisma:migrate     # Tạo và chạy migrations
npm run prisma:studio      # Mở Prisma Studio (GUI để quản lý DB)
```

### Testing

```bash
npm run test               # Chạy unit tests
npm run test:watch         # Chạy tests với watch mode
npm run test:cov           # Test coverage report
npm run test:e2e           # Chạy E2E tests
```

## 🔐 API Endpoints

### Authentication (`/auth`)

| Method | Endpoint                | Description                  | Auth |
| ------ | ----------------------- | ---------------------------- | ---- |
| `POST` | `/auth/signup`          | Đăng ký tài khoản mới        | ❌   |
| `POST` | `/auth/login`           | Đăng nhập (email/password)   | ❌   |
| `POST` | `/auth/google/id-token` | Đăng nhập Google (ID Token)  | ❌   |
| `POST` | `/auth/google/code`     | Đăng nhập Google (Auth Code) | ❌   |
| `POST` | `/auth/refresh`         | Refresh access token         | ❌   |
| `POST` | `/auth/logout`          | Đăng xuất                    | ✅   |
| `GET`  | `/auth/me`              | Lấy thông tin user hiện tại  | ✅   |

### Papers (`/papers`)

| Method   | Endpoint                          | Description                | Auth |
| -------- | --------------------------------- | -------------------------- | ---- |
| `POST`   | `/papers`                         | Tạo paper mới (sau upload) | ✅   |
| `GET`    | `/papers`                         | Danh sách papers của user  | ✅   |
| `GET`    | `/papers/:id`                     | Chi tiết 1 paper           | ✅   |
| `DELETE` | `/papers/:id`                     | Xóa paper                  | ✅   |
| `GET`    | `/papers/:id/suggested-questions` | Câu hỏi gợi ý (brainstorm) | ✅   |
| `GET`    | `/papers/:id/related-papers`      | Papers liên quan (arXiv)   | ✅   |

### Chat (`/chat`)

| Method   | Endpoint                         | Description                    | Auth |
| -------- | -------------------------------- | ------------------------------ | ---- |
| `POST`   | `/chat/ask`                      | Hỏi về 1 paper                 | ✅   |
| `POST`   | `/chat/ask-multi`                | Hỏi về nhiều papers            | ✅   |
| `POST`   | `/chat/explain-region`           | Giải thích vùng chọn trong PDF | ✅   |
| `GET`    | `/chat/messages/:conversationId` | Lịch sử chat                   | ✅   |
| `DELETE` | `/chat/history/:conversationId`  | Xóa lịch sử                    | ✅   |

### Conversations (`/conversations`)

| Method   | Endpoint             | Description             | Auth |
| -------- | -------------------- | ----------------------- | ---- |
| `POST`   | `/conversations`     | Tạo conversation mới    | ✅   |
| `GET`    | `/conversations`     | Danh sách conversations | ✅   |
| `GET`    | `/conversations/:id` | Chi tiết conversation   | ✅   |
| `DELETE` | `/conversations/:id` | Xóa conversation        | ✅   |

### Folders (`/folders`)

| Method   | Endpoint                        | Description                | Auth |
| -------- | ------------------------------- | -------------------------- | ---- |
| `POST`   | `/folders`                      | Tạo folder mới             | ✅   |
| `GET`    | `/folders`                      | Danh sách folders          | ✅   |
| `GET`    | `/folders/uncategorized`        | Papers không có folder     | ✅   |
| `GET`    | `/folders/:id`                  | Chi tiết folder (+ papers) | ✅   |
| `PATCH`  | `/folders/:id`                  | Cập nhật folder            | ✅   |
| `DELETE` | `/folders/:id`                  | Xóa folder                 | ✅   |
| `PATCH`  | `/folders/papers/:paperId/move` | Di chuyển paper            | ✅   |

### Upload (`/upload`)

| Method | Endpoint           | Description         | Auth |
| ------ | ------------------ | ------------------- | ---- |
| `POST` | `/upload/single`   | Upload 1 PDF lên S3 | ✅   |
| `POST` | `/upload/multiple` | Upload nhiều PDFs   | ✅   |

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

> 📖 **Swagger UI**: Xem chi tiết và test API tại `http://localhost:3000/api`

## 🛠️ Tech Stack

| Category           | Technology           |
| ------------------ | -------------------- |
| **Framework**      | NestJS 10 LTS        |
| **Language**       | TypeScript 5.x       |
| **Database**       | PostgreSQL 12+       |
| **ORM**            | Prisma 6.x           |
| **Authentication** | JWT + Passport.js    |
| **OAuth**          | Google Auth Library  |
| **File Storage**   | AWS S3 / MinIO       |
| **Validation**     | class-validator, Zod |
| **API Docs**       | Swagger/OpenAPI      |
| **Testing**        | Jest                 |

## 🔧 Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/rag_scientific?schema=public"
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=rag_scientific
POSTGRES_PORT=5432

# JWT
JWT_SECRET="your-super-secret-key"
JWT_ACCESS_EXPIRES="15m"
JWT_REFRESH_EXPIRES="7d"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# S3 / MinIO
S3_ENDPOINT="http://localhost:9000"
S3_ACCESS_KEY="minioadmin"
S3_SECRET_KEY="minioadmin"
S3_BUCKET="rag-scientific"
S3_REGION="us-east-1"

# RAG Service
RAG_SERVICE_URL="http://localhost:8000"

# Application
PORT=3000
NODE_ENV=development
```

## 📝 Notes

- Đảm bảo PostgreSQL đang chạy trước khi start ứng dụng
- RAG_BE_02 service cần chạy để các tính năng AI hoạt động
- JWT tokens có thời gian hết hạn (mặc định: 15 phút cho access token)
- Swagger UI chỉ khả dụng trong development mode

## 🔗 Related Services

| Service               | Port | Description               |
| --------------------- | ---- | ------------------------- |
| **rag-scientific-be** | 3000 | This service (NestJS API) |
| **rag-scientific-fe** | 5173 | React Frontend            |
| **RAG_BE_02**         | 8000 | Python RAG Service        |
| **PostgreSQL**        | 5432 | Database                  |
| **GROBID**            | 8070 | PDF Metadata Extraction   |
| **MinIO**             | 9000 | S3-compatible Storage     |

## 🤝 Contributing

1. Fork the project
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

---

<div align="center">

**[⬆ Back to Top](#-rag-scientific---backend-api)**

Made with ❤️ using NestJS

</div>
