# RAG Scientific Backend API

Backend API cho hệ thống RAG (Retrieval-Augmented Generation) Scientific sử dụng NestJS 10 LTS.

## 📋 Yêu cầu hệ thống

- **Node.js**: >= 20.0.0
- **npm**: >= 10.0.0
- **PostgreSQL**: >= 12.0 (hoặc sử dụng Docker Compose)

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
│   └── schema.prisma          # Prisma schema definition
├── src/
│   ├── auth/                  # Authentication module
│   │   ├── dto/              # Data Transfer Objects
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── jwt.strategy.ts
│   ├── users/                 # Users module
│   │   ├── users.service.ts
│   │   └── users.module.ts
│   ├── prisma/                # Prisma module
│   │   ├── prisma.service.ts
│   │   └── prisma.module.ts
│   ├── app.module.ts          # Root module
│   └── main.ts                # Application entry point
├── test/                      # E2E tests
├── docker-compose.yml         # Docker Compose config
├── package.json
└── README.md
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

### Authentication

- `POST /auth/signup` - Đăng ký user mới
- `POST /auth/login` - Đăng nhập
- `POST /auth/logout` - Đăng xuất (cần JWT token)

### Health Check

- `GET /` - Health check endpoint

Xem chi tiết tất cả endpoints tại Swagger UI: `http://localhost:3000/api`

## 🛠️ Tech Stack

- **Framework**: NestJS 10 LTS
- **Database**: PostgreSQL với Prisma ORM
- **Authentication**: JWT (Passport.js)
- **Validation**: class-validator, class-transformer
- **API Documentation**: Swagger/OpenAPI
- **Testing**: Jest

## 📝 Notes

- Đảm bảo PostgreSQL đang chạy trước khi start ứng dụng
- Swagger UI chỉ hiển thị khi chạy development mode
- JWT tokens có thời gian hết hạn (mặc định: 15 phút cho access token, 7 ngày cho refresh token)

## 🤝 Contributing

1. Fork the project
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🔗 Links

- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Swagger Documentation](https://swagger.io/docs)
