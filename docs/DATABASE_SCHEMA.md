# 📚 Database Schema Documentation

## Tổng quan

RAG Scientific sử dụng PostgreSQL làm database chính với Prisma ORM. Schema được thiết kế để hỗ trợ:

1. **User Management**: Xác thực đa nền tảng (Local + Google OAuth)
2. **Paper Management**: Quản lý tài liệu PDF và tích hợp RAG service
3. **Conversation System**: Lưu trữ lịch sử chat với AI
4. **Caching Layer**: Cache kết quả AI để tối ưu hiệu suất

---

## 📊 Entity Relationship Diagram

```
┌─────────────────┐
│      users      │
├─────────────────┤
│ id (PK)         │
│ email           │
│ provider        │
│ ...             │
└────────┬────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐       ┌─────────────────┐
│ refresh_tokens  │       │     folders     │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │
│ user_id (FK)    │       │ user_id (FK)    │
│ token           │       │ name            │
│ ...             │       │ ...             │
└─────────────────┘       └────────┬────────┘
                                   │ 1:N
                                   ▼
                          ┌─────────────────┐
                          │     papers      │
                          ├─────────────────┤
                          │ id (PK)         │
                          │ user_id (FK)    │
                          │ folder_id (FK)  │◄── nullable
                          │ rag_file_id     │◄── CRITICAL
                          │ ...             │
                          └────────┬────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │ 1:N                    │ 1:N                    │ 1:N
          ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  conversations  │    │suggested_quest..│    │  related_papers │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ id (PK)         │    │ id (PK)         │    │ id (PK)         │
│ paper_id (FK)   │    │ paper_id (FK)   │    │ paper_id (FK)   │
│ user_id (FK)    │    │ question        │    │ arxiv_id        │
│ type            │    │ ...             │    │ score           │
│ ...             │    └─────────────────┘    │ ...             │
└────────┬────────┘                           └─────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐    ┌─────────────────────┐
│    messages     │    │ conversation_papers │
├─────────────────┤    ├─────────────────────┤
│ id (PK)         │    │ id (PK)             │
│ conversation_id │    │ conversation_id (FK)│
│ role            │    │ paper_id (FK)       │
│ content         │    │ order_index         │
│ context (JSONB) │    └─────────────────────┘
│ ...             │           ▲
└─────────────────┘           │
                              │ N:M (for MULTI_PAPER)
                    ──────────┘
```

---

## 🔑 Enums

### AuthProvider

| Value    | Mô tả                       |
| -------- | --------------------------- |
| `LOCAL`  | Đăng ký bằng email/password |
| `GOOGLE` | Đăng nhập qua Google OAuth  |

### PaperStatus

| Value        | Mô tả                                             |
| ------------ | ------------------------------------------------- |
| `PENDING`    | Vừa upload, chờ xử lý                             |
| `PROCESSING` | RAG service đang ingest (GROBID parse, embedding) |
| `COMPLETED`  | Sẵn sàng cho Q&A                                  |
| `FAILED`     | Xử lý thất bại (xem `error_message`)              |

### ConversationType

| Value          | Mô tả                              |
| -------------- | ---------------------------------- |
| `SINGLE_PAPER` | Chat về 1 paper duy nhất           |
| `MULTI_PAPER`  | Chat về nhiều papers (cross-paper) |

### MessageRole

| Value       | Mô tả                  |
| ----------- | ---------------------- |
| `USER`      | Câu hỏi của người dùng |
| `ASSISTANT` | Câu trả lời từ AI      |

---

## 📋 Chi tiết các Table

### 1. `users` - Bảng người dùng

**Mục đích**: Lưu trữ thông tin tài khoản, hỗ trợ cả xác thực local và OAuth.

| Column          | Type         | Constraints               | Mô tả                                 |
| --------------- | ------------ | ------------------------- | ------------------------------------- |
| `id`            | UUID         | PK, auto                  | ID duy nhất của user                  |
| `email`         | VARCHAR(255) | UNIQUE, NOT NULL          | Email đăng nhập                       |
| `password_hash` | VARCHAR(255) | NULL                      | Hash bcrypt (null nếu chỉ dùng OAuth) |
| `provider`      | AuthProvider | NOT NULL, DEFAULT 'LOCAL' | Phương thức đăng ký                   |
| `provider_id`   | VARCHAR(255) | NULL                      | ID từ OAuth provider (Google sub)     |
| `display_name`  | VARCHAR(100) | NULL                      | Tên hiển thị                          |
| `avatar_url`    | VARCHAR(500) | NULL                      | URL avatar (từ Google hoặc upload)    |
| `is_active`     | BOOLEAN      | DEFAULT true              | Trạng thái tài khoản                  |
| `last_login_at` | TIMESTAMPTZ  | NULL                      | Lần đăng nhập cuối                    |
| `created_at`    | TIMESTAMPTZ  | DEFAULT NOW               | Ngày tạo                              |
| `updated_at`    | TIMESTAMPTZ  | DEFAULT NOW               | Ngày cập nhật                         |

**Indexes**:

- `users_email_key` (UNIQUE): Tìm kiếm nhanh theo email
- `users_provider_provider_id_key` (UNIQUE): Ngăn trùng lặp OAuth account

**Business Rules**:

- User có thể link nhiều provider (chưa implement)
- `password_hash` null khi user chỉ đăng ký qua Google

---

### 2. `refresh_tokens` - JWT Refresh Tokens

**Mục đích**: Quản lý refresh token cho JWT authentication, hỗ trợ logout từ xa và theo dõi thiết bị.

| Column        | Type         | Constraints          | Mô tả                    |
| ------------- | ------------ | -------------------- | ------------------------ |
| `id`          | UUID         | PK, auto             | ID duy nhất              |
| `user_id`     | UUID         | FK → users, NOT NULL | User sở hữu token        |
| `token`       | VARCHAR(500) | UNIQUE, NOT NULL     | Refresh token value      |
| `device_info` | VARCHAR(500) | NULL                 | User-Agent của thiết bị  |
| `ip_address`  | VARCHAR(50)  | NULL                 | IP address khi tạo token |
| `expires_at`  | TIMESTAMPTZ  | NOT NULL             | Thời điểm hết hạn        |
| `is_revoked`  | BOOLEAN      | DEFAULT false        | Đã thu hồi chưa          |
| `created_at`  | TIMESTAMPTZ  | DEFAULT NOW          | Ngày tạo                 |

**Indexes**:

- `refresh_tokens_token_key` (UNIQUE): Tìm kiếm khi validate
- `refresh_tokens_expires_at_idx`: Cleanup expired tokens

**Business Rules**:

- Token bị revoke khi logout
- Có thể revoke all tokens để force logout all devices
- Expired tokens nên được cleanup định kỳ

---

### 3. `folders` - Thư mục tổ chức Papers

**Mục đích**: Cho phép user sắp xếp papers vào các thư mục như trong thư viện.

| Column        | Type         | Constraints          | Mô tả                       |
| ------------- | ------------ | -------------------- | --------------------------- |
| `id`          | UUID         | PK, auto             | ID thư mục                  |
| `user_id`     | UUID         | FK → users, NOT NULL | User sở hữu                 |
| `name`        | VARCHAR(100) | NOT NULL             | Tên thư mục                 |
| `order_index` | INTEGER      | DEFAULT 0            | Thứ tự hiển thị (drag-drop) |
| `created_at`  | TIMESTAMPTZ  | DEFAULT NOW          | Ngày tạo                    |
| `updated_at`  | TIMESTAMPTZ  | DEFAULT NOW          | Ngày cập nhật               |

**Constraints**:

- `folders_user_id_name_key` (UNIQUE): Tên folder unique per user

**Business Rules**:

- Xóa folder → papers trong đó chuyển về "Uncategorized" (folder_id = NULL)
- `order_index` dùng cho tính năng drag-drop sắp xếp

---

### 4. `papers` - Tài liệu PDF ⭐ CORE ENTITY

**Mục đích**: Lưu thông tin PDF đã upload và link đến RAG service để thực hiện Q&A.

| Column            | Type          | Constraints          | Mô tả                               |
| ----------------- | ------------- | -------------------- | ----------------------------------- |
| `id`              | UUID          | PK, auto             | ID trong hệ thống NestJS            |
| `user_id`         | UUID          | FK → users, NOT NULL | User sở hữu                         |
| `folder_id`       | UUID          | FK → folders, NULL   | Thư mục chứa (null = uncategorized) |
| `file_name`       | VARCHAR(255)  | NOT NULL             | Tên file gốc                        |
| `file_url`        | VARCHAR(1000) | NOT NULL             | URL trên S3/Cloud storage           |
| `file_size`       | BIGINT        | NULL                 | Kích thước file (bytes)             |
| `file_hash`       | VARCHAR(64)   | NULL                 | SHA-256 hash để detect duplicate    |
| **`rag_file_id`** | VARCHAR(100)  | **UNIQUE, NOT NULL** | **⚠️ CRITICAL: ID trong RAG_BE_02** |
| `title`           | VARCHAR(500)  | NULL                 | Tiêu đề (từ GROBID)                 |
| `abstract`        | TEXT          | NULL                 | Tóm tắt (từ GROBID)                 |
| `authors`         | TEXT          | NULL                 | Tác giả (comma-separated)           |
| `num_pages`       | INTEGER       | NULL                 | Số trang                            |
| `status`          | PaperStatus   | DEFAULT 'PENDING'    | Trạng thái xử lý                    |
| `error_message`   | TEXT          | NULL                 | Chi tiết lỗi nếu FAILED             |
| `node_count`      | INTEGER       | NULL                 | Số text nodes sau ingest            |
| `table_count`     | INTEGER       | NULL                 | Số bảng được extract                |
| `image_count`     | INTEGER       | NULL                 | Số hình được extract                |
| `processed_at`    | TIMESTAMPTZ   | NULL                 | Thời điểm hoàn thành                |
| `created_at`      | TIMESTAMPTZ   | DEFAULT NOW          | Ngày upload                         |
| `updated_at`      | TIMESTAMPTZ   | DEFAULT NOW          | Ngày cập nhật                       |

**⚠️ CRITICAL FIELD: `rag_file_id`**

Đây là trường quan trọng nhất trong schema:

- **Maps to**: `file_id` parameter trong tất cả API calls đến RAG_BE_02
- **Format**: UUID string (ví dụ: `8fc4b997-0165-41c4-8e5c-f2effa478855`)
- **Used in**:
  - `/ingest` - Ingest PDF vào vector store
  - `/query` - Query RAG để trả lời câu hỏi
  - `/brainstorm` - Generate suggested questions
  - `/get_related_papers` - Tìm papers liên quan
  - `/status/{file_id}` - Check processing status

```typescript
// Example: Query RAG service
await ragService.query({
  file_id: paper.ragFileId, // ← Map từ DB
  query: 'What is the main contribution?',
  top_k: 10,
});
```

**Status Flow**:

```
PENDING → PROCESSING → COMPLETED
                   ↘ FAILED
```

---

### 5. `conversations` - Phiên chat

**Mục đích**: Mỗi conversation là một phiên hội thoại riêng biệt về paper(s).

| Column       | Type             | Constraints            | Mô tả                         |
| ------------ | ---------------- | ---------------------- | ----------------------------- |
| `id`         | UUID             | PK, auto               | ID conversation               |
| `user_id`    | UUID             | FK → users, NOT NULL   | User tạo                      |
| `paper_id`   | UUID             | FK → papers, NOT NULL  | Paper chính (required)        |
| `title`      | VARCHAR(300)     | NULL                   | Tiêu đề (auto từ câu hỏi đầu) |
| `type`       | ConversationType | DEFAULT 'SINGLE_PAPER' | Loại conversation             |
| `created_at` | TIMESTAMPTZ      | DEFAULT NOW            | Ngày tạo                      |
| `updated_at` | TIMESTAMPTZ      | DEFAULT NOW            | Ngày cập nhật                 |

**Conversation Types**:

**SINGLE_PAPER**: Chat về 1 paper

- `paper_id` chứa paper đang chat
- Không dùng `conversation_papers`

**MULTI_PAPER**: Chat về nhiều papers

- `paper_id` chứa paper "chính" (paper đầu tiên được thêm)
- Các papers khác link qua `conversation_papers`
- RAG query gửi multiple file_ids

---

### 6. `conversation_papers` - Link Papers với Conversations

**Mục đích**: Junction table cho MULTI_PAPER conversations.

| Column            | Type        | Constraints        | Mô tả                    |
| ----------------- | ----------- | ------------------ | ------------------------ |
| `id`              | UUID        | PK, auto           | ID                       |
| `conversation_id` | UUID        | FK → conversations | Conversation             |
| `paper_id`        | UUID        | FK → papers        | Paper trong conversation |
| `order_index`     | INTEGER     | DEFAULT 0          | Thứ tự papers            |
| `created_at`      | TIMESTAMPTZ | DEFAULT NOW        | Ngày thêm                |

**Constraints**:

- `conversation_papers_conversation_id_paper_id_key` (UNIQUE): Không duplicate paper trong conversation

---

### 7. `messages` - Tin nhắn trong Conversation

**Mục đích**: Lưu trữ từng message trong conversation, bao gồm cả context từ RAG để hiển thị citations.

| Column            | Type          | Constraints        | Mô tả                                     |
| ----------------- | ------------- | ------------------ | ----------------------------------------- |
| `id`              | UUID          | PK, auto           | ID message                                |
| `conversation_id` | UUID          | FK → conversations | Conversation chứa                         |
| `role`            | MessageRole   | NOT NULL           | USER hoặc ASSISTANT                       |
| `content`         | TEXT          | NOT NULL           | Nội dung message                          |
| `image_url`       | VARCHAR(1000) | NULL               | URL hình ảnh (nếu user chọn image để hỏi) |
| `model_name`      | VARCHAR(100)  | NULL               | Model AI đã dùng (GPT-4, etc.)            |
| `token_count`     | INTEGER       | NULL               | Số tokens tiêu thụ                        |
| `context`         | JSONB         | DEFAULT '{}'       | **RAG context cho citations**             |
| `created_at`      | TIMESTAMPTZ   | DEFAULT NOW        | Thời điểm gửi                             |

**Context JSONB Structure**:

```json
{
  "retrieved_texts": [
    {
      "content": "The methodology involves...",
      "page": 5,
      "score": 0.89
    }
  ],
  "retrieved_tables": [
    {
      "table_id": "table_1",
      "summary": "Performance comparison",
      "page": 12
    }
  ],
  "retrieved_images": [
    {
      "image_id": "fig_3",
      "summary": "Architecture diagram",
      "page": 8
    }
  ]
}
```

---

### 8. `suggested_questions` - Câu hỏi gợi ý

**Mục đích**: Cache câu hỏi do AI generate (brainstorm feature) để không phải gọi API nhiều lần.

| Column        | Type        | Constraints | Mô tả            |
| ------------- | ----------- | ----------- | ---------------- |
| `id`          | UUID        | PK, auto    | ID               |
| `paper_id`    | UUID        | FK → papers | Paper liên quan  |
| `question`    | TEXT        | NOT NULL    | Nội dung câu hỏi |
| `order_index` | INTEGER     | NOT NULL    | Thứ tự hiển thị  |
| `created_at`  | TIMESTAMPTZ | DEFAULT NOW | Ngày generate    |

**Business Rules**:

- Cached vô thời hạn (paper không đổi)
- Xóa khi paper bị xóa (CASCADE)
- Có thể regenerate bằng cách xóa cache

---

### 9. `related_papers` - Papers liên quan từ arXiv

**Mục đích**: Cache kết quả tìm kiếm papers liên quan từ arXiv API (qua RAG service).

| Column        | Type           | Constraints | Mô tả                         |
| ------------- | -------------- | ----------- | ----------------------------- |
| `id`          | UUID           | PK, auto    | ID                            |
| `paper_id`    | UUID           | FK → papers | Paper gốc                     |
| `arxiv_id`    | VARCHAR(50)    | NOT NULL    | arXiv ID (e.g., "2301.00001") |
| `title`       | VARCHAR(500)   | NOT NULL    | Tiêu đề                       |
| `abstract`    | TEXT           | NOT NULL    | Tóm tắt                       |
| `authors`     | VARCHAR(255)[] | NOT NULL    | Mảng tên tác giả              |
| `categories`  | VARCHAR(50)[]  | NOT NULL    | Mảng categories (cs.AI, etc.) |
| `url`         | VARCHAR(500)   | NOT NULL    | URL đến arXiv                 |
| `score`       | DOUBLE         | NOT NULL    | Điểm liên quan (0-1)          |
| `reason`      | TEXT           | NOT NULL    | Lý do AI cho là liên quan     |
| `order_index` | INTEGER        | NOT NULL    | Thứ tự (by score)             |
| `created_at`  | TIMESTAMPTZ    | DEFAULT NOW | Ngày cache                    |

**Constraints**:

- `related_papers_paper_id_arxiv_id_key` (UNIQUE): Không duplicate arXiv paper

---

## 🔄 Cascade Rules

| Parent        | Child               | On Delete            |
| ------------- | ------------------- | -------------------- |
| users         | refresh_tokens      | CASCADE              |
| users         | folders             | CASCADE              |
| users         | papers              | CASCADE              |
| users         | conversations       | CASCADE              |
| folders       | papers              | SET NULL ← Đặc biệt! |
| papers        | conversations       | CASCADE              |
| papers        | suggested_questions | CASCADE              |
| papers        | related_papers      | CASCADE              |
| conversations | messages            | CASCADE              |
| conversations | conversation_papers | CASCADE              |

**Lưu ý**: Xóa folder chỉ SET NULL `folder_id` của papers, không xóa papers.

---

## 📈 Performance Indexes

### Query Patterns Optimized:

1. **User's papers list**: `papers_user_id_idx`
2. **Papers in folder**: `papers_folder_id_idx`
3. **RAG lookup**: `papers_rag_file_id_idx`
4. **Conversation history**: `conversations_user_id_idx`, `messages_conversation_id_idx`
5. **Token cleanup**: `refresh_tokens_expires_at_idx`

---

## 🛠️ Migration Commands

```bash
# Generate migration from schema changes
npx prisma migrate dev --name <migration_name>

# Apply migrations to production
npx prisma migrate deploy

# Reset database (DEV ONLY)
npx prisma migrate reset

# View current migration status
npx prisma migrate status
```

---

## 📝 Notes for Developers

1. **RAG File ID Lifecycle**:
   - Generated by NestJS backend (UUID v4)
   - Sent to RAG_BE_02 during `/ingest`
   - Used in all subsequent RAG API calls
   - Must be preserved - cannot regenerate without re-ingesting

2. **Status Polling**:
   - After upload, poll `/status/{rag_file_id}` until COMPLETED
   - Interval: 2-5 seconds
   - Timeout: 5-10 minutes depending on file size

3. **Context JSONB**:
   - Store full RAG response for citations UI
   - Do NOT normalize into separate tables (performance)
   - Size can be large (~50KB per message)

4. **Cleanup Jobs (Recommended)**:
   - Expired refresh tokens: Daily
   - Failed papers older than 7 days: Weekly
   - Orphaned files in S3: Monthly
