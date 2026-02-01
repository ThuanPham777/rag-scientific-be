# Simplified Database Schema & Cloud Storage Integration

## Overview

This document describes the simplified database schema and cloud storage integration for the RAG Scientific platform.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React)                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BACKEND (NestJS)                                     │
│  1. User uploads PDF                                                         │
│  2. Backend saves to S3/MinIO                                                │
│  3. Backend creates Paper record (status: PENDING)                           │
│  4. Backend calls RAG /ingest-from-url with S3 URL                           │
│  5. Backend updates Paper with metadata from RAG                             │
└─────────────────────────────────────────────────────────────────────────────┘
          │                                │
          │ PostgreSQL                     │ HTTP/REST
          ▼                                ▼
┌───────────────────┐         ┌─────────────────────────────────────────────┐
│    PostgreSQL     │         │           RAG SERVICE (Python)              │
│    ┌───────────┐  │         │                                             │
│    │ users     │  │         │  POST /ingest-from-url  (NEW - cloud URL)   │
│    │ papers    │  │         │  POST /upload           (original - file)   │
│    │ convers.  │  │         │  POST /query                                │
│    │ messages  │  │         │  POST /explain-region                       │
│    │ suggested │  │         │  GET  /status/{file_id}                     │
│    └───────────┘  │         │                                             │
└───────────────────┘         │  ┌───────────────────────────────────────┐  │
                              │  │ Downloads PDF from S3 → Local temp    │  │
                              │  │ Processes with GROBID, PyMuPDF        │  │
                              │  │ Stores embeddings in ChromaDB         │  │
                              │  └───────────────────────────────────────┘  │
                              └─────────────────────────────────────────────┘
                                                │
                                                ▼
                              ┌─────────────────────────────────────────────┐
                              │            S3 / MinIO                        │
                              │         (Cloud Storage)                      │
                              │    ┌─────────────────────────┐              │
                              │    │ papers/                 │              │
                              │    │   {file_id}.pdf         │              │
                              │    └─────────────────────────┘              │
                              └─────────────────────────────────────────────┘
```

## Database Schema (Simplified)

### Tables

| Table                 | Description                                    |
| --------------------- | ---------------------------------------------- |
| `users`               | User accounts                                  |
| `papers`              | PDF documents (links to RAG via `rag_file_id`) |
| `conversations`       | Chat sessions per paper                        |
| `messages`            | Chat messages (user questions + AI answers)    |
| `suggested_questions` | Cached brainstorm results                      |

### Entity Relationship

```
users
  │
  ├──< papers (1:N)
  │      │
  │      └──< conversations (1:N)
  │             │
  │             └──< messages (1:N)
  │
  └──< conversations (1:N)
```

### Key Fields

#### papers

```sql
rag_file_id VARCHAR(100) UNIQUE  -- Maps to file_id in RAG_BE_02
file_url    VARCHAR(1000)        -- S3/Cloud URL
status      ENUM                  -- PENDING, PROCESSING, COMPLETED, FAILED
```

#### messages

```sql
role        ENUM                  -- USER or ASSISTANT
content     TEXT                  -- Question or Answer
context     JSONB                 -- RAG retrieval context (for ASSISTANT)
```

## RAG_BE_02 Modifications

### New Endpoint: `/ingest-from-url`

```python
POST /ingest-from-url
Content-Type: application/json

{
    "file_url": "s3://bucket/papers/abc123.pdf",
    "file_id": "abc123"  // optional, auto-generated if not provided
}
```

Response:

```json
{
  "message": "Ingested from URL successfully",
  "file_id": "abc123",
  "status": "completed",
  "processing_time": 45.2,
  "title": "Paper Title from GROBID",
  "abstract": "Paper abstract...",
  "node_count": 42,
  "table_count": 5,
  "image_count": 8
}
```

### How It Works

1. **FileConfig** now accepts an optional `cloud_url` parameter
2. When `pdf_path` is accessed, it automatically downloads from cloud if needed
3. Processing (GROBID, PyMuPDF, embeddings) works exactly the same
4. No changes to `langchain_multimodal.py`, `pdf_extract.py`, etc.

### Storage Backend

The new `storage.py` module provides:

```python
# Auto-detect storage type based on environment
from storage import get_storage_backend

storage = get_storage_backend()  # Returns LocalStorageBackend or S3StorageBackend
```

## Environment Variables

### For Cloud Storage (S3/MinIO)

```env
# MinIO (self-hosted)
S3_ENDPOINT_URL=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=rag-papers

# Or AWS S3
# S3_BUCKET=my-bucket
# S3_REGION=us-east-1
# AWS_ACCESS_KEY_ID=...
# AWS_SECRET_ACCESS_KEY=...
```

### For Local Storage (default)

If no S3 variables are set, the system uses local storage (original behavior).

## Backend Integration Example (NestJS)

### Upload Flow

```typescript
// paper.service.ts
async uploadPaper(userId: string, file: Express.Multer.File) {
  // 1. Generate file_id
  const fileId = uuidv4();

  // 2. Upload to S3
  const s3Key = `papers/${fileId}.pdf`;
  const fileUrl = await this.s3Service.upload(file.buffer, s3Key);

  // 3. Create paper record
  const paper = await this.prisma.paper.create({
    data: {
      userId,
      fileName: file.originalname,
      fileUrl,
      fileSize: file.size,
      ragFileId: fileId,
      status: 'PENDING',
    },
  });

  // 4. Call RAG service
  try {
    const ragResponse = await this.http.axiosRef.post(
      `${process.env.RAG_SERVICE_URL}/ingest-from-url`,
      { file_url: fileUrl, file_id: fileId }
    );

    // 5. Update paper with metadata
    await this.prisma.paper.update({
      where: { id: paper.id },
      data: {
        status: 'COMPLETED',
        title: ragResponse.data.title,
        abstract: ragResponse.data.abstract,
        nodeCount: ragResponse.data.node_count,
        tableCount: ragResponse.data.table_count,
        imageCount: ragResponse.data.image_count,
        processedAt: new Date(),
      },
    });
  } catch (error) {
    await this.prisma.paper.update({
      where: { id: paper.id },
      data: { status: 'FAILED', errorMessage: error.message },
    });
    throw error;
  }

  return paper;
}
```

### Query Flow

```typescript
// chat.service.ts
async askQuestion(userId: string, dto: AskQuestionDto) {
  const { conversationId, question } = dto;

  // Get paper's rag_file_id
  const conversation = await this.prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { paper: true },
  });

  // Save user message
  const userMsg = await this.prisma.message.create({
    data: {
      conversationId,
      role: 'USER',
      content: question,
    },
  });

  // Call RAG service
  const ragResponse = await this.http.axiosRef.post(
    `${process.env.RAG_SERVICE_URL}/query`,
    {
      file_id: conversation.paper.ragFileId,
      question,
    }
  );

  // Save assistant message
  const assistantMsg = await this.prisma.message.create({
    data: {
      conversationId,
      role: 'ASSISTANT',
      content: ragResponse.data.answer,
      context: ragResponse.data.context,
    },
  });

  return {
    answer: ragResponse.data.answer,
    context: ragResponse.data.context,
    messageId: assistantMsg.id,
  };
}
```

## Quick Start

### 1. Setup Database

```bash
# Apply migrations
psql -U postgres -d rag_scientific < prisma/migrations/001_simple_schema.sql

# Or use Prisma
cp prisma/schema.simple.prisma prisma/schema.prisma
npx prisma migrate dev --name init
```

### 2. Setup MinIO (optional, for cloud storage)

```bash
# docker-compose.yml
docker-compose up -d minio
```

### 3. Configure RAG Service

```bash
cd RAG_BE_02

# For cloud storage
export S3_ENDPOINT_URL=http://localhost:9000
export S3_ACCESS_KEY=minioadmin
export S3_SECRET_KEY=minioadmin
export S3_BUCKET=rag-papers

# Start service
pip install -r requirements.txt
uvicorn api:app --reload --port 8000
```

### 4. Test Integration

```bash
# Test ingest from URL
curl -X POST http://localhost:8000/ingest-from-url \
  -H "Content-Type: application/json" \
  -d '{"file_url": "s3://rag-papers/test.pdf", "file_id": "test123"}'

# Test query
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{"file_id": "test123", "question": "What is this paper about?"}'
```

## Summary

| What Changed       | Description                             |
| ------------------ | --------------------------------------- |
| `config.py`        | `FileConfig` now supports cloud URLs    |
| `storage.py`       | New file - S3/local storage abstraction |
| `api.py`           | New `/ingest-from-url` endpoint         |
| `requirements.txt` | Added `boto3`                           |
| Database           | Simplified 5-table schema               |

| What Stayed Same          | Description      |
| ------------------------- | ---------------- |
| `langchain_multimodal.py` | No changes       |
| `pdf_extract.py`          | No changes       |
| `rag_pipeline.py`         | No changes       |
| `vectorstore_setup.py`    | No changes       |
| Processing logic          | Exactly the same |
