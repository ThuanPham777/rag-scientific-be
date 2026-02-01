# RAG Service - Backend Integration Guide

This guide explains how to integrate the RAG Service (Python/FastAPI) with the Backend (NestJS) using the new database schema.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React)                                │
│                         rag-scientific-fe                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BACKEND (NestJS)                                   │
│                         rag-scientific-be                                    │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Services:                                                              ││
│  │  - AuthService (JWT, OAuth)                                             ││
│  │  - PaperService (CRUD, sharing)                                         ││
│  │  - ConversationService (chat management)                                ││
│  │  - ChatService (RAG orchestration)                                      ││
│  │  - WorkspaceService (team collaboration)                                ││
│  │  - IngestionService (job management)                                    ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
          │                                │
          │ PostgreSQL                     │ HTTP/REST
          ▼                                ▼
┌───────────────────┐         ┌─────────────────────────────────────────────┐
│    PostgreSQL     │         │              RAG SERVICE (Python)            │
│    Database       │         │                 RAG_BE_02                    │
│  ┌─────────────┐  │         │  ┌─────────────────────────────────────────┐│
│  │ users       │  │         │  │  Endpoints:                             ││
│  │ papers      │  │         │  │  POST /upload      (PDF ingestion)      ││
│  │ conversations│ │         │  │  POST /query       (RAG query)          ││
│  │ messages    │  │         │  │  POST /explain-region (visual AI)       ││
│  │ chunks      │  │         │  │  POST /related-papers (ArXiv)           ││
│  │ ...         │  │         │  │  POST /brainstorm-questions             ││
│  └─────────────┘  │         │  │  GET  /status/{file_id}                 ││
└───────────────────┘         │  └─────────────────────────────────────────┘│
                              │  ┌─────────────────────────────────────────┐│
                              │  │  ChromaDB (Vector Store)                ││
                              │  └─────────────────────────────────────────┘│
                              └─────────────────────────────────────────────┘
```

## Integration Flows

### 1. PDF Upload & Ingestion

```
Frontend                    Backend (NestJS)                RAG Service
   │                              │                              │
   │  POST /papers/upload         │                              │
   │  (multipart/form-data)       │                              │
   │─────────────────────────────>│                              │
   │                              │                              │
   │                              │  1. Save file to S3          │
   │                              │  2. Create Paper record      │
   │                              │     (status: PENDING)        │
   │                              │  3. Create IngestionJob      │
   │                              │     (status: PENDING)        │
   │                              │                              │
   │  { paperId, status }         │                              │
   │<─────────────────────────────│                              │
   │                              │                              │
   │                              │  POST /upload                │
   │                              │  (file + file_id)            │
   │                              │─────────────────────────────>│
   │                              │                              │
   │                              │                              │  Extract PDF
   │                              │                              │  (GROBID, tables, images)
   │                              │                              │
   │                              │                              │  Build embeddings
   │                              │                              │  (ChromaDB)
   │                              │                              │
   │                              │  { status, metadata }        │
   │                              │<─────────────────────────────│
   │                              │                              │
   │                              │  4. Update Paper             │
   │                              │     (title, abstract, etc)   │
   │                              │  5. Update IngestionJob      │
   │                              │     (status: COMPLETED)      │
   │                              │  6. Create Chunks            │
   │                              │     (link to ChromaDB)       │
   │                              │                              │
```

### 2. Chat Query

```
Frontend                    Backend (NestJS)                RAG Service
   │                              │                              │
   │  POST /chat/ask              │                              │
   │  { conversationId,           │                              │
   │    paperId, question }       │                              │
   │─────────────────────────────>│                              │
   │                              │                              │
   │                              │  1. Validate conversation    │
   │                              │  2. Create user Message      │
   │                              │  3. Create QaTurn            │
   │                              │                              │
   │                              │  POST /query                 │
   │                              │  { file_id, question }       │
   │                              │─────────────────────────────>│
   │                              │                              │
   │                              │                              │  Retrieve from
   │                              │                              │  ChromaDB
   │                              │                              │
   │                              │                              │  Generate answer
   │                              │                              │  (GPT-4o-mini)
   │                              │                              │
   │                              │  { answer, context }         │
   │                              │<─────────────────────────────│
   │                              │                              │
   │                              │  4. Create assistant Message │
   │                              │  5. Update QaTurn            │
   │                              │     (latency, tokens, cost)  │
   │                              │  6. Create AnswerCitations   │
   │                              │                              │
   │  { answer, citations,        │                              │
   │    messageId }               │                              │
   │<─────────────────────────────│                              │
   │                              │                              │
```

### 3. Multi-PDF Chat (Collection)

```
Frontend                    Backend (NestJS)                RAG Service
   │                              │                              │
   │  POST /collections           │                              │
   │  { name, paperIds[] }        │                              │
   │─────────────────────────────>│                              │
   │                              │                              │
   │                              │  Create PaperCollection      │
   │                              │  Create CollectionPapers     │
   │                              │                              │
   │  { collectionId }            │                              │
   │<─────────────────────────────│                              │
   │                              │                              │
   │  POST /chat/ask              │                              │
   │  { collectionId, question }  │                              │
   │─────────────────────────────>│                              │
   │                              │                              │
   │                              │  Get papers in collection    │
   │                              │  For each paper:             │
   │                              │    POST /query               │
   │                              │    { file_id, question }     │
   │                              │─────────────────────────────>│
   │                              │                              │
   │                              │  Merge results               │
   │                              │  Re-rank by relevance        │
   │                              │                              │
   │  { answer, citations[] }     │                              │
   │<─────────────────────────────│                              │
```

## Backend Service Implementation

### 1. PaperService (Enhanced)

```typescript
// src/paper/paper.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { PaperStatus, JobStatus } from '../common/types/database.types';

@Injectable()
export class PaperService {
  constructor(
    private prisma: PrismaService,
    private http: HttpService,
  ) {}

  async uploadPaper(userId: string, file: Express.Multer.File) {
    // 1. Upload to S3
    const fileUrl = await this.uploadToS3(file);

    // 2. Create paper record
    const paper = await this.prisma.paper.create({
      data: {
        ownerId: userId,
        fileUrl,
        filePath: file.originalname,
        fileSize: file.size,
        status: PaperStatus.PENDING,
      },
    });

    // 3. Create ingestion job
    const job = await this.prisma.ingestionJob.create({
      data: {
        paperId: paper.id,
        status: JobStatus.PENDING,
      },
    });

    // 4. Trigger RAG processing (async)
    this.processWithRag(paper.id, fileUrl, job.id);

    return { paperId: paper.id, jobId: job.id };
  }

  private async processWithRag(
    paperId: string,
    fileUrl: string,
    jobId: string,
  ) {
    try {
      // Update job status
      await this.prisma.ingestionJob.update({
        where: { id: jobId },
        data: { status: JobStatus.RUNNING, startedAt: new Date() },
      });

      // Call RAG service
      const ragResponse = await this.http.axiosRef.post(
        `${process.env.RAG_SERVICE_URL}/upload`,
        { file_id: paperId },
        // ... upload file
      );

      // Update paper with metadata
      await this.prisma.paper.update({
        where: { id: paperId },
        data: {
          ragFileId: ragResponse.data.file_id,
          status: PaperStatus.COMPLETED,
          vectorSyncedAt: new Date(),
        },
      });

      // Update job
      await this.prisma.ingestionJob.update({
        where: { id: jobId },
        data: {
          status: JobStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      await this.prisma.ingestionJob.update({
        where: { id: jobId },
        data: {
          status: JobStatus.FAILED,
          errorMessage: error.message,
        },
      });
    }
  }
}
```

### 2. ChatService (Enhanced)

```typescript
// src/chat/chat.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HttpService } from '@nestjs/axios';

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private http: HttpService,
  ) {}

  async askQuestion(userId: string, dto: AskQuestionDto) {
    const { conversationId, question } = dto;

    // Get conversation with paper/collection context
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        paper: true,
        collection: { include: { papers: { include: { paper: true } } } },
      },
    });

    // Create user message
    const userMessage = await this.prisma.message.create({
      data: {
        conversationId,
        role: 'USER',
        content: question,
      },
    });

    // Create QA turn
    const qaTurn = await this.prisma.qaTurn.create({
      data: {
        conversationId,
        userMessageId: userMessage.id,
        modeSnapshot: conversation.mode,
      },
    });

    const startTime = Date.now();

    // Determine which papers to query
    let papersToQuery: { id: string; ragFileId: string }[] = [];

    if (conversation.paperId) {
      // Single paper chat
      papersToQuery = [conversation.paper];
    } else if (conversation.collectionId) {
      // Multi-PDF chat
      papersToQuery = conversation.collection.papers.map((cp) => cp.paper);
    }

    // Query RAG service for each paper
    const results = await Promise.all(
      papersToQuery.map((paper) =>
        this.http.axiosRef.post(`${process.env.RAG_SERVICE_URL}/query`, {
          file_id: paper.ragFileId,
          question,
        }),
      ),
    );

    // Merge and rank results (for multi-PDF)
    const mergedAnswer = this.mergeResults(results, question);

    // Create assistant message
    const assistantMessage = await this.prisma.message.create({
      data: {
        conversationId,
        role: 'ASSISTANT',
        content: mergedAnswer.answer,
        tokenCount: mergedAnswer.tokenOutput,
      },
    });

    // Update QA turn
    await this.prisma.qaTurn.update({
      where: { id: qaTurn.id },
      data: {
        assistantMessageId: assistantMessage.id,
        latencyMs: Date.now() - startTime,
        tokenInput: mergedAnswer.tokenInput,
        tokenOutput: mergedAnswer.tokenOutput,
      },
    });

    // Create citations
    await this.createCitations(qaTurn.id, mergedAnswer.citations);

    return {
      answer: mergedAnswer.answer,
      citations: mergedAnswer.citations,
      messageId: assistantMessage.id,
    };
  }

  private mergeResults(results: any[], question: string) {
    // Implement result merging and re-ranking logic
    // For single paper, just return the result
    // For multi-PDF, merge contexts and re-rank
    return results[0].data;
  }

  private async createCitations(qaTurnId: string, citations: any[]) {
    // Create AnswerCitation records
    for (const citation of citations) {
      await this.prisma.answerCitation.create({
        data: {
          qaTurnId,
          pageNumber: citation.page,
          sourceSnippet: citation.snippet,
          citationIndex: citation.index,
          relevanceScore: citation.score,
        },
      });
    }
  }
}
```

### 3. WorkspaceService (New)

```typescript
// src/workspace/workspace.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WorkspaceService {
  constructor(private prisma: PrismaService) {}

  async createWorkspace(userId: string, dto: CreateWorkspaceDto) {
    return this.prisma.workspace.create({
      data: {
        ownerId: userId,
        name: dto.name,
        slug: this.generateSlug(dto.name),
        description: dto.description,
        visibility: dto.visibility || 'PRIVATE',
      },
    });
  }

  async inviteMember(workspaceId: string, email: string, role: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    return this.prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: user.id,
        role,
        status: 'PENDING',
      },
    });
  }

  async addPaperToWorkspace(
    workspaceId: string,
    paperId: string,
    userId: string,
  ) {
    return this.prisma.workspacePaper.create({
      data: {
        workspaceId,
        paperId,
        addedBy: userId,
      },
    });
  }

  async getWorkspacePapers(workspaceId: string) {
    return this.prisma.workspacePaper.findMany({
      where: { workspaceId },
      include: { paper: true },
    });
  }
}
```

## API Endpoints Summary

### Papers

| Method | Endpoint          | Description           |
| ------ | ----------------- | --------------------- |
| POST   | /papers/upload    | Upload PDF            |
| GET    | /papers           | List user's papers    |
| GET    | /papers/:id       | Get paper details     |
| DELETE | /papers/:id       | Soft delete paper     |
| POST   | /papers/:id/share | Share paper with user |

### Workspaces

| Method | Endpoint                | Description            |
| ------ | ----------------------- | ---------------------- |
| POST   | /workspaces             | Create workspace       |
| GET    | /workspaces             | List user's workspaces |
| POST   | /workspaces/:id/members | Invite member          |
| POST   | /workspaces/:id/papers  | Add paper to workspace |

### Collections

| Method | Endpoint                | Description             |
| ------ | ----------------------- | ----------------------- |
| POST   | /collections            | Create collection       |
| GET    | /collections            | List collections        |
| POST   | /collections/:id/papers | Add paper to collection |

### Chat

| Method | Endpoint                   | Description             |
| ------ | -------------------------- | ----------------------- |
| POST   | /conversations             | Create conversation     |
| GET    | /conversations             | List conversations      |
| POST   | /chat/ask                  | Ask question            |
| POST   | /chat/explain-region       | Explain visual region   |
| GET    | /chat/suggestions/:paperId | Get suggested questions |

### Ingestion Jobs

| Method | Endpoint            | Description          |
| ------ | ------------------- | -------------------- |
| GET    | /jobs/:paperId      | Get ingestion status |
| GET    | /jobs/:paperId/logs | Get processing logs  |

## Environment Variables

```env
# Backend
DATABASE_URL=postgresql://user:pass@localhost:5432/rag_scientific
JWT_SECRET=your-secret-key
S3_BUCKET=your-bucket
S3_REGION=us-east-1

# RAG Service
RAG_SERVICE_URL=http://localhost:8000

# Optional: Analytics
ENABLE_USAGE_LOGGING=true
```

## Database Migration

1. Backup existing data
2. Run the SQL migration:
   ```bash
   psql -U postgres -d rag_scientific < prisma/migrations/001_complete_schema.sql
   ```
3. Or use Prisma:
   ```bash
   npx prisma migrate dev --name complete_schema
   ```
4. Generate Prisma client:
   ```bash
   npx prisma generate
   ```

## Testing the Integration

```bash
# 1. Start PostgreSQL
docker-compose up -d postgres

# 2. Run migrations
npx prisma migrate deploy

# 3. Start RAG service
cd RAG_BE_02
uvicorn api:app --reload --port 8000

# 4. Start NestJS backend
cd rag-scientific-be
npm run start:dev

# 5. Test upload
curl -X POST http://localhost:3000/papers/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@paper.pdf"

# 6. Test chat
curl -X POST http://localhost:3000/chat/ask \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"conversationId": "<id>", "question": "What is the main contribution?"}'
```
