# Database Schema Design - RAG Scientific Platform

## Overview

This document describes the enterprise-grade PostgreSQL database schema designed for the RAG Scientific platform - a "Chat with PDF" application inspired by SciSpace.

## Architecture Goals

1. **Scalability**: Support millions of papers and users
2. **Multi-PDF Chat**: Chat across multiple papers simultaneously
3. **Team Collaboration**: Share papers, workspaces, and conversations
4. **Full RAG Tracking**: Track ingestion, embeddings, and retrieval
5. **Analytics Ready**: Usage tracking, cost analysis, performance metrics
6. **Soft Deletes**: Data recovery and audit trails

---

## Entity Relationship Diagram (Conceptual)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER MANAGEMENT                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  User ─┬─── OAuthAccount (Google, GitHub, ORCID)                            │
│        ├─── ApiKey (Programmatic access)                                     │
│        ├─── Workspace (owns) ─── WorkspaceMember (team)                      │
│        ├─── Paper (owns)                                                     │
│        ├─── PaperAccess (shared papers)                                      │
│        └─── Conversation                                                     │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           PAPER STRUCTURE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Paper ─┬─── PaperPage (1 per PDF page)                                      │
│         │       └─── PaperElement (text, figure, table, equation)            │
│         ├─── PaperSection (Abstract, Introduction, Methods...)               │
│         │       └─── PaperElement                                            │
│         ├─── Chunk (for RAG retrieval)                                       │
│         │       └─── ChunkElement (links to elements)                        │
│         ├─── IngestionJob (processing status)                                │
│         │       └─── IngestionLog (detailed logs)                            │
│         └─── RelatedPaper (AI suggestions)                                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           CHAT & COLLABORATION                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  Workspace ─── WorkspacePaper ─── Paper                                      │
│            └── PaperCollection ─── CollectionPaper ─── Paper                 │
│                                                                              │
│  Conversation ─┬─── Message (user/assistant)                                 │
│   (paper/      ├─── QaTurn (question-answer pair)                            │
│   collection/  │       ├─── AnswerCitation (source references)               │
│   workspace)   │       └─── FormulaInsight (equation explanations)           │
│                └─── SelectionRegion (visual regions)                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Section 1: User Management & Authentication

### User

Core user account supporting multiple auth methods.

| Field        | Type         | Description                       |
| ------------ | ------------ | --------------------------------- |
| id           | UUID         | Primary key                       |
| email        | VARCHAR(255) | Unique email                      |
| passwordHash | VARCHAR(255) | Bcrypt hash (nullable for OAuth)  |
| displayName  | VARCHAR(100) | Display name                      |
| role         | ENUM         | USER, PREMIUM, ADMIN, SUPER_ADMIN |
| isActive     | BOOLEAN      | Account status                    |
| isVerified   | BOOLEAN      | Email verified                    |
| preferences  | JSON         | User settings                     |

### OAuthAccount

Links external OAuth providers (Google, GitHub, ORCID).

### ApiKey

For programmatic API access with scopes and expiration.

---

## Section 2: Workspace & Team Collaboration

### Workspace

Organizes papers for team collaboration.

| Field      | Type         | Description             |
| ---------- | ------------ | ----------------------- |
| id         | UUID         | Primary key             |
| ownerId    | UUID         | FK to User              |
| name       | VARCHAR(200) | Workspace name          |
| slug       | VARCHAR(100) | URL-friendly identifier |
| visibility | ENUM         | PRIVATE, TEAM, PUBLIC   |
| settings   | JSON         | Custom settings         |

### WorkspaceMember

Team membership with role-based access.

| Role   | Permissions                    |
| ------ | ------------------------------ |
| OWNER  | Full control, delete workspace |
| ADMIN  | Manage members, settings       |
| EDITOR | Add/remove papers, chat        |
| VIEWER | Read-only access               |

### WorkspacePaper

Junction table linking papers to workspaces (many-to-many).

---

## Section 3: Paper Management

### Paper

Core paper entity with full metadata.

| Field          | Type          | Description                 |
| -------------- | ------------- | --------------------------- |
| id             | UUID          | Primary key                 |
| ownerId        | UUID          | FK to User (owner)          |
| title          | VARCHAR(500)  | Paper title                 |
| abstract       | TEXT          | Abstract text               |
| authors        | JSON          | Array of author objects     |
| doi            | VARCHAR(100)  | DOI (unique)                |
| arxivId        | VARCHAR(50)   | ArXiv ID (unique)           |
| status         | ENUM          | Processing status           |
| ragFileId      | VARCHAR(100)  | ID in RAG service           |
| vectorSyncedAt | TIMESTAMP     | Last sync with vector store |
| fileUrl        | VARCHAR(1000) | S3/storage URL              |
| fileHash       | VARCHAR(64)   | File checksum               |

**Status Flow:**

```
PENDING → UPLOADING → PROCESSING → EXTRACTING → EMBEDDING → COMPLETED
                                                         ↓
                                                      FAILED
```

### PaperPage

One row per PDF page with dimensions and raw text.

### PaperSection

Logical sections from GROBID parsing.

| SectionType  |
| ------------ |
| ABSTRACT     |
| INTRODUCTION |
| BACKGROUND   |
| METHODS      |
| RESULTS      |
| DISCUSSION   |
| CONCLUSION   |
| REFERENCES   |

### PaperElement

Individual content elements (figures, tables, equations).

| ElementType | Description          |
| ----------- | -------------------- |
| TEXT        | Regular text block   |
| FIGURE      | Image/diagram        |
| TABLE       | Data table           |
| EQUATION    | Mathematical formula |
| CODE        | Code snippet         |

---

## Section 4: Chunking & Vector Storage

### Chunk

Text chunks for RAG retrieval with vector store references.

| Field          | Type         | Description                  |
| -------------- | ------------ | ---------------------------- |
| id             | UUID         | Primary key                  |
| paperId        | UUID         | FK to Paper                  |
| content        | TEXT         | Chunk text                   |
| tokenCount     | INT          | Token count                  |
| externalVecId  | VARCHAR(100) | ChromaDB document ID         |
| embeddingModel | VARCHAR(100) | Model used                   |
| modality       | ENUM         | TEXT, TABLE, IMAGE, ABSTRACT |

### ChunkElement

Links chunks to source elements for citation tracking.

---

## Section 5: Multi-PDF Chat Support

### PaperCollection

Groups papers for cross-paper chat sessions.

```sql
-- Example: Create a collection for a research topic
INSERT INTO paper_collections (workspace_id, name, description)
VALUES ('ws-uuid', 'Transformer Papers 2024', 'Latest transformer architecture papers');

-- Add papers to collection
INSERT INTO collection_papers (collection_id, paper_id, order_index)
VALUES ('col-uuid', 'paper1-uuid', 1),
       ('col-uuid', 'paper2-uuid', 2);
```

### RelatedPaper

AI-suggested related papers (from ArXiv, etc.).

---

## Section 6: Conversation & Chat

### Conversation

Chat session that can target:

- Single paper (`paperId`)
- Paper collection (`collectionId`)
- Entire workspace (`workspaceId`)

| ChatMode   | Description                    |
| ---------- | ------------------------------ |
| NOVICE     | Beginner-friendly explanations |
| EXPERT     | Technical, concise responses   |
| CREATIVE   | Exploratory discussions        |
| ANALYTICAL | Data-focused analysis          |

### Message

Individual chat messages.

### QaTurn

Tracks each question-answer pair with:

- RAG configuration used
- Performance metrics (latency, tokens, cost)
- Quality signals

### AnswerCitation

Links answer text to source chunks/elements.

```sql
-- Example: Citation linking answer to source
INSERT INTO answer_citations (qa_turn_id, chunk_id, page_number, citation_index)
VALUES ('turn-uuid', 'chunk-uuid', 5, 1); -- [S1] in answer
```

---

## Section 7: Visual Analysis

### SelectionRegion

User-selected regions for visual explanation.

| Field                 | Description         |
| --------------------- | ------------------- |
| bboxX, bboxY          | Position            |
| bboxWidth, bboxHeight | Dimensions          |
| imageBase64           | Captured image      |
| extractedText         | OCR text            |
| latex                 | LaTeX for equations |

### FormulaInsight

AI-generated explanations for equations.

---

## Section 8: Ingestion & Processing

### IngestionJob

Tracks PDF processing jobs.

| Field        | Type    | Description                         |
| ------------ | ------- | ----------------------------------- |
| status       | ENUM    | PENDING, RUNNING, COMPLETED, FAILED |
| currentStep  | VARCHAR | grobid, chunking, embedding         |
| progress     | INT     | 0-100 percentage                    |
| nodeCount    | INT     | Extracted nodes                     |
| errorMessage | TEXT    | Error details                       |

### IngestionLog

Detailed step-by-step logs.

---

## Section 9: Usage & Analytics

### UsageLog

Tracks all API calls for billing and analytics.

| Field      | Description                   |
| ---------- | ----------------------------- |
| action     | upload, query, explain_region |
| tokensUsed | LLM tokens consumed           |
| costUsd    | Computed cost                 |
| latencyMs  | Response time                 |

---

## Section 10: Suggested Questions

### SuggestedQuestion

AI-generated questions from brainstorming.

| Category    | Example                                      |
| ----------- | -------------------------------------------- |
| METHODOLOGY | "How was the training data collected?"       |
| RESULTS     | "What were the key findings?"                |
| LIMITATION  | "What are the limitations of this approach?" |

---

## Key Design Patterns

### 1. Soft Deletes

Papers and conversations use `deletedAt` for soft deletes:

```sql
-- Query active papers only
SELECT * FROM papers WHERE deleted_at IS NULL;
```

### 2. JSON Columns for Flexibility

- `authors` (array of objects)
- `metaJson` (arbitrary metadata)
- `preferences` (user settings)

### 3. Audit Timestamps

All tables include:

- `createdAt` (auto-set)
- `updatedAt` (auto-updated)

### 4. UUID Primary Keys

All IDs use `gen_random_uuid()` for:

- Distributed generation
- No sequential prediction
- URL-safe identifiers

---

## Query Examples

### 1. Get User's Papers with Processing Status

```sql
SELECT p.id, p.title, p.status, ij.progress
FROM papers p
LEFT JOIN ingestion_jobs ij ON p.id = ij.paper_id
WHERE p.owner_id = 'user-uuid'
  AND p.deleted_at IS NULL
ORDER BY p.created_at DESC;
```

### 2. Multi-PDF Chat Context

```sql
-- Get all papers in a collection for chat
SELECT p.id, p.title, p.rag_file_id
FROM papers p
JOIN collection_papers cp ON p.id = cp.paper_id
WHERE cp.collection_id = 'collection-uuid'
ORDER BY cp.order_index;
```

### 3. Team Collaboration - Shared Papers

```sql
-- Papers accessible to a user (owned + shared)
SELECT DISTINCT p.*
FROM papers p
LEFT JOIN paper_access pa ON p.id = pa.paper_id
LEFT JOIN workspace_papers wp ON p.id = wp.paper_id
LEFT JOIN workspace_members wm ON wp.workspace_id = wm.workspace_id
WHERE p.owner_id = 'user-uuid'
   OR pa.user_id = 'user-uuid'
   OR wm.user_id = 'user-uuid';
```

### 4. Usage Analytics

```sql
-- Daily usage stats
SELECT
    DATE(created_at) as date,
    action,
    COUNT(*) as count,
    SUM(tokens_used) as total_tokens,
    SUM(cost_usd) as total_cost
FROM usage_logs
WHERE user_id = 'user-uuid'
GROUP BY DATE(created_at), action
ORDER BY date DESC;
```

---

## Integration with RAG Service

### Mapping RAG Service → Database

| RAG Service Field | Database Table.Column     |
| ----------------- | ------------------------- |
| `file_id`         | `Paper.ragFileId`         |
| `paper_id`        | `Paper.id`                |
| `title`           | `Paper.title`             |
| `abstract`        | `Paper.abstract`          |
| `node_count`      | `IngestionJob.nodeCount`  |
| `table_count`     | `IngestionJob.tableCount` |
| `image_count`     | `IngestionJob.imageCount` |

### Sync Flow

```
1. User uploads PDF → Create Paper (status: PENDING)
2. Call RAG /upload → Create IngestionJob (status: RUNNING)
3. RAG processes → Update IngestionJob logs
4. RAG completes → Update Paper (status: COMPLETED, ragFileId)
5. RAG chunks → Store in Chunk table
```

---

## Migration Guide

To migrate from the current schema:

1. **Backup existing data**
2. **Run migration script** (creates new tables, migrates data)
3. **Update NestJS services** to use new models
4. **Update RAG service** callbacks to sync with new schema

---

## Performance Indexes

Key indexes for common queries:

```sql
-- User queries
CREATE INDEX idx_papers_owner ON papers(owner_id);
CREATE INDEX idx_conversations_user ON conversations(user_id);

-- Paper lookups
CREATE INDEX idx_papers_rag_file_id ON papers(rag_file_id);
CREATE INDEX idx_papers_status ON papers(status);

-- Chat queries
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_qa_turns_conversation ON qa_turns(conversation_id);

-- Analytics
CREATE INDEX idx_usage_logs_user_date ON usage_logs(user_id, created_at);
```

---

## Future Extensions

The schema supports future features:

1. **Annotations**: Add `Annotation` table for highlights
2. **Bookmarks**: Add `Bookmark` table for saved positions
3. **Export**: Add `Export` table for PDF/summary exports
4. **Billing**: Add `Subscription`, `Invoice` tables
5. **AI Agents**: Add `Agent`, `AgentTask` for autonomous research
