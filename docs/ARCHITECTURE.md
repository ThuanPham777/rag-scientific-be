# RAG Scientific — Architecture Documentation

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [ERD & Schema Design](#erd--schema-design)
4. [Database Tables](#database-tables)
5. [API Design](#api-design)
6. [WebSocket Events](#websocket-events)
7. [Backend Architecture](#backend-architecture)
8. [Flow Diagrams](#flow-diagrams)
9. [Design Decisions](#design-decisions)
10. [Frontend Integration Guide](#frontend-integration-guide)
11. [File Structure](#file-structure)

---

## Overview

**RAG Scientific** (AskPDF) is an AI-powered research paper analysis platform built with a microservices architecture. The system supports:

- **AI Q&A** with single or multiple research papers via Retrieval-Augmented Generation (RAG)
- **Multimodal analysis** of text, tables, and images within PDF documents
- **Collaborative sessions** where multiple users chat, annotate, and discuss papers in real-time
- **PDF annotations** with highlights (5 colors) and threaded comments
- **Rich-text notebooks** with collaborative editing via Yjs CRDT
- **Paper management** with folders, summary generation, and related paper discovery
- **Guest mode** for anonymous access with 24-hour auto-cleanup

### Key Concepts

| Concept                | Description                                                     |
| ---------------------- | --------------------------------------------------------------- |
| **Session**            | A collaborative mode activated on an existing conversation      |
| **Session Code**       | 8-char unique identifier for a session (e.g., `A1B2C3D4`)       |
| **Invite Token**       | 64-char hex token used in shareable links                       |
| **Session Member**     | A user who has joined a session (OWNER or MEMBER)               |
| **Shared Annotations** | Highlights and comments visible to all session members          |
| **RAG File ID**        | UUID linking a paper between the NestJS backend and RAG service |
| **Notebook**           | Rich-text document (Tiptap HTML) with optional collaboration    |
| **Yjs CRDT**           | Conflict-free replicated data type for real-time notebook sync  |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT (Browser)                              │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │              React SPA (rag-scientific-fe)                       │   │
│   │  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌──────────────────┐  │   │
│   │  │ PDF      │ │ Chat      │ │ Library  │ │ Notebook Editor  │  │   │
│   │  │ Viewer   │ │ Interface │ │ Manager  │ │ (Tiptap)         │  │   │
│   │  └──────────┘ └───────────┘ └──────────┘ └──────────────────┘  │   │
│   │                                                                  │   │
│   │  State: React Query (server) + Zustand (UI)                      │   │
│   └───────────────────────────┬──────────────────────────────────────┘   │
│                               │ HTTP (REST) + WebSocket                  │
└───────────────────────────────┼──────────────────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                        BACKEND LAYER                                      │
│                                                                           │
│   ┌────────────────────────────────┐    ┌──────────────────────────────┐  │
│   │   NestJS API (port 3000)        │    │  RAG Service (FastAPI, 8000) │  │
│   │                                │    │                              │  │
│   │  • Auth (JWT + Google OAuth)   │    │  • PDF Extraction (GROBID    │  │
│   │  • Paper CRUD                  │◄──►│    + PyMuPDF + Camelot)      │  │
│   │  • Conversation management     │HTTP│  • Semantic Chunking         │  │
│   │  • Chat orchestration          │    │  • Multimodal Summarization  │  │
│   │  • File upload (S3)            │    │  • Vector Store (ChromaDB)   │  │
│   │  • Highlight & Comments        │    │  • RAG Query Pipeline        │  │
│   │  • Collaborative Sessions      │    │  • ArXiv Related Papers      │  │
│   │  • Notebook CRUD & Collab      │    │  • Paper Summarization       │  │
│   │  • WebSocket Gateway           │    │                              │  │
│   │  • Guest Mode                  │    │  LLMs: GPT-4o-mini + Llama 4│  │
│   │  • Scheduled Cleanup           │    │  Embedding: text-embedding   │  │
│   └────────────┬───────────────────┘    └──────────────┬───────────────┘  │
│                │                                       │                  │
│   ┌────────────────────────────┐                       │                  │
│   │  Yjs WebSocket Server      │                       │                  │
│   │  (port 1234)               │                       │                  │
│   │  Real-time notebook collab │                       │                  │
│   └────────────────────────────┘                       │                  │
│                │                                       │                  │
│                │         ┌─────────────────┐           │                  │
│                ├────────►│   PostgreSQL     │◄──────────┤                  │
│                │         │   (Shared DB)    │           │                  │
│                │         └─────────────────┘           │                  │
│                │                                       │                  │
│                │         ┌─────────────────┐           │                  │
│                ├────────►│   AWS S3/MinIO   │◄──────────┤                  │
│                │         │   (PDF Storage)  │           │                  │
│                │         └─────────────────┘           │                  │
│                │                            ┌──────────┴──────────┐       │
│                │                            │    ChromaDB          │       │
│                │                            │  (Vector Embeddings) │       │
│                │                            └─────────────────────┘       │
└───────────────┴───────────────────────────────────────────────────────────┘
```

### Service Breakdown

| Service                  | Tech               | Port | Role                                            |
| ------------------------ | ------------------ | ---- | ----------------------------------------------- |
| **rag-scientific-fe**    | React + Vite       | 5173 | Frontend SPA                                    |
| **rag-scientific-be**    | NestJS             | 3000 | API gateway, business logic, auth               |
| **Pipeline_RAG**         | FastAPI (Python)   | 8000 | PDF processing, embedding, RAG pipeline, LLMs   |
| **Yjs WebSocket Server** | y-websocket (Node) | 1234 | Real-time collaborative notebook editing (CRDT) |

---

## ERD & Schema Design

```
┌─────────────────┐
│      users      │
├─────────────────┤
│ id (PK)         │
│ email           │
│ display_name    │
│ avatar_url      │
│ ...             │
└──┬──┬──┬──┬──┬──┘
   │  │  │  │  │
   │  │  │  │  │ 1:N                    1:N
   │  │  │  │  ├───────────────────────────────────┐
   │  │  │  │  │                                   │
   │  │  │  │  ▼                                   ▼
   │  │  │  │ ┌──────────────────┐   ┌──────────────────────┐
   │  │  │  │ │ session_members  │   │   session_invites    │
   │  │  │  │ ├──────────────────┤   ├──────────────────────┤
   │  │  │  │ │ id (PK)          │   │ id (PK)              │
   │  │  │  │ │ conversation_id  │──┐│ conversation_id (FK) │──┐
   │  │  │  │ │ user_id (FK)     │  ││ invited_by (FK)      │  │
   │  │  │  │ │ role (ENUM)      │  ││ invite_token (UQ)    │  │
   │  │  │  │ │ is_active        │  ││ expires_at           │  │
   │  │  │  │ │ joined_at        │  ││ max_uses             │  │
   │  │  │  │ │ left_at          │  ││ use_count            │  │
   │  │  │  │ └──────────────────┘  ││ is_revoked           │  │
   │  │  │  │                       │└──────────────────────┘  │
   │  │  │  │         ┌─────────────┘                          │
   │  │  │  │         │  ┌────────────────────────────────────┘
   │  │  │  │         ▼  ▼
   │  │  │  │ ┌───────────────────┐
   │  │  │  │ │  conversations    │
   │  │  │  │ ├───────────────────┤
   │  │  │  │ │ id (PK)           │
   │  │  │  │ │ user_id (FK)      │ ◄── Original owner
   │  │  │  │ │ paper_id (FK)     │
   │  │  │  │ │ title             │
   │  │  │  │ │ type              │
   │  │  │  │ │ is_collaborative  │
   │  │  │  │ │ session_code      │ (unique)
   │  │  │  │ │ max_members       │
   │  │  │  │ └────────┬──────────┘
   │  │  │  │          │
   │  │  │  │          │ 1:N
   │  │  │  │          ▼
   │  │  │  │ ┌───────────────────┐
   │  │  │  │ │    messages       │
   │  │  │  │ ├───────────────────┤
   │  │  │  │ │ id (PK)           │
   │  │  │  │ │ conversation_id   │
   │  │  │  │ │ user_id (FK)      │ (who sent it)
   │  │  │  │ │ role              │
   │  │  │  │ │ content           │
   │  │  │  │ │ reply_to_msg_id   │ (threaded replies)
   │  │  │  │ │ deleted_at        │ (soft delete)
   │  │  │  │ │ ...               │
   │  │  │  │ └──────────┬────────┘
   │  │  │  │            │ 1:N
   │  │  │  │            ▼
   │  │  │  │ ┌───────────────────┐
   │  │  │  │ │message_reactions  │
   │  │  │  │ ├───────────────────┤
   │  │  │  │ │ emoji             │
   │  │  │  │ └───────────────────┘
   │  │  │  │
   │  │  │  │         ┌─────────────┐
   │  │  │  │         │   papers    │
   │  │  │  │         ├─────────────┤
   │  │  │  └────────▶│ id (PK)     │
   │  │  │            │ user_id     │
   │  │  │            │ rag_file_id │ ◄── Links to RAG service
   │  │  │            │ ...         │
   │  │  │            └──────┬──────┘
   │  │  │                   │ 1:N
   │  │  │                   ▼
   │  │  │         ┌──────────────────┐
   │  │  └────────▶│   highlights     │
   │  │            ├──────────────────┤
   │  │            │ id (PK)          │
   │  │            │ paper_id (FK)    │
   │  │            │ user_id (FK)     │ ◄── Creator (shared visibility)
   │  │            │ page_number      │
   │  │            │ color            │
   │  │            │ ...              │
   │  │            └────────┬─────────┘
   │  │                     │ 1:N
   │  │                     ▼
   │  │         ┌──────────────────────┐
   │  └────────▶│ highlight_comments   │
   │            ├──────────────────────┤
   │            │ id (PK)              │
   │            │ highlight_id (FK)    │
   │            │ user_id (FK)         │ ◄── Any session member can comment
   │            │ content              │
   │            └──────────────────────┘
   │
   │     ┌───────────────────┐        ┌──────────────────────────┐
   └────►│    notebooks      │───────►│ notebook_collaborators   │
         ├───────────────────┤        ├──────────────────────────┤
         │ id (PK)           │        │ id (PK)                  │
         │ title             │        │ notebook_id (FK)         │
         │ content (HTML)    │        │ user_id (FK)             │
         │ is_collaborative  │        │ is_hidden                │
         │ share_token       │        └──────────────────────────┘
         └───────────────────┘
```

---

## Database Tables

### Core Tables

| #   | Table                    | Description                                  |
| --- | ------------------------ | -------------------------------------------- |
| 1   | `users`                  | User accounts (Local + Google OAuth)         |
| 2   | `refresh_tokens`         | JWT refresh tokens (multi-device)            |
| 3   | `folders`                | Folder organization for papers               |
| 4   | `papers`                 | Core entity — PDF documents                  |
| 5   | `conversations`          | Chat sessions (single/multi/group)           |
| 6   | `conversation_papers`    | Junction table for multi-paper conversations |
| 7   | `messages`               | Chat messages (user + AI + system)           |
| 8   | `message_reactions`      | Emoji reactions on messages                  |
| 9   | `suggested_questions`    | Cached AI-generated questions                |
| 10  | `related_papers`         | Cached arXiv related papers                  |
| 11  | `highlights`             | PDF text highlights                          |
| 12  | `highlight_comments`     | Comments on highlights                       |
| 13  | `session_members`        | Collaborative session membership             |
| 14  | `session_invites`        | Invite links for sessions                    |
| 15  | `notebooks`              | Rich-text notebooks (Tiptap HTML)            |
| 16  | `notebook_collaborators` | Notebook collaboration membership            |

### RAG Service Tables (owned by Python Pipeline_RAG)

| #   | Table                     | Description                            |
| --- | ------------------------- | -------------------------------------- |
| 17  | `rag_paper_cache`         | MD5 hash cache for rebuild detection   |
| 18  | `paper_content_summaries` | Cached LLM summaries for tables/images |

### `session_members`

Many-to-many relationship between users and conversations.

| Column            | Type                    | Description                            |
| ----------------- | ----------------------- | -------------------------------------- |
| `id`              | UUID (PK)               | Primary key                            |
| `conversation_id` | UUID (FK)               | References `conversations.id`          |
| `user_id`         | UUID (FK)               | References `users.id`                  |
| `role`            | ENUM(`OWNER`, `MEMBER`) | Role in session                        |
| `is_active`       | BOOLEAN                 | Whether the member is currently active |
| `joined_at`       | TIMESTAMPTZ             | When the user joined                   |
| `left_at`         | TIMESTAMPTZ             | When the user left (nullable)          |

**Constraints:** `UNIQUE(conversation_id, user_id)`

### `session_invites`

Manages shareable invite links.

| Column            | Type         | Description                   |
| ----------------- | ------------ | ----------------------------- |
| `id`              | UUID (PK)    | Primary key                   |
| `conversation_id` | UUID (FK)    | References `conversations.id` |
| `invited_by`      | UUID (FK)    | User who created the invite   |
| `invite_token`    | VARCHAR(100) | Unique shareable token        |
| `expires_at`      | TIMESTAMPTZ  | Expiration time               |
| `max_uses`        | INTEGER      | Max uses (0 = unlimited)      |
| `use_count`       | INTEGER      | Current usage count           |
| `is_revoked`      | BOOLEAN      | Whether revoked by owner      |

### `conversations` (collaborative columns)

| Column             | Type        | Default | Description                                          |
| ------------------ | ----------- | ------- | ---------------------------------------------------- |
| `is_collaborative` | BOOLEAN     | `false` | Whether this conversation is a collaborative session |
| `session_code`     | VARCHAR(20) | `null`  | Unique session code (e.g., `A1B2C3D4`)               |
| `max_members`      | INTEGER     | `10`    | Maximum number of members allowed                    |

### `messages` (collaborative/social columns)

| Column                | Type      | Default | Description                                             |
| --------------------- | --------- | ------- | ------------------------------------------------------- |
| `user_id`             | UUID (FK) | `null`  | References `users.id` — identifies who sent the message |
| `reply_to_message_id` | UUID (FK) | `null`  | Self-referencing FK for threaded replies                |
| `deleted_at`          | TIMESTAMP | `null`  | Soft delete timestamp                                   |

### `notebooks`

| Column             | Type         | Description                         |
| ------------------ | ------------ | ----------------------------------- |
| `id`               | UUID (PK)    | Primary key                         |
| `user_id`          | UUID (FK)    | Owner of the notebook               |
| `title`            | VARCHAR(500) | Notebook title                      |
| `content`          | TEXT         | HTML content (Tiptap editor format) |
| `order_index`      | INTEGER      | Display ordering                    |
| `is_collaborative` | BOOLEAN      | Whether shared for collaboration    |
| `share_token`      | VARCHAR(100) | Unique token for sharing (nullable) |
| `original_id`      | UUID         | ID of original notebook if copied   |
| `created_at`       | TIMESTAMPTZ  | Creation timestamp                  |
| `updated_at`       | TIMESTAMPTZ  | Last update timestamp               |

### `notebook_collaborators`

| Column        | Type        | Description                   |
| ------------- | ----------- | ----------------------------- |
| `id`          | UUID (PK)   | Primary key                   |
| `notebook_id` | UUID (FK)   | References `notebooks.id`     |
| `user_id`     | UUID (FK)   | References `users.id`         |
| `joined_at`   | TIMESTAMPTZ | When the user joined          |
| `is_hidden`   | BOOLEAN     | Soft-hide for individual user |

**Constraints:** `UNIQUE(notebook_id, user_id)`

### Enums

| Enum               | Values                                         |
| ------------------ | ---------------------------------------------- |
| `AuthProvider`     | `LOCAL`, `GOOGLE`                              |
| `PaperStatus`      | `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED` |
| `ConversationType` | `SINGLE_PAPER`, `MULTI_PAPER`, `GROUP`         |
| `MessageRole`      | `USER`, `ASSISTANT`, `SYSTEM`                  |
| `HighlightColor`   | `YELLOW`, `GREEN`, `BLUE`, `PINK`, `ORANGE`    |
| `SessionRole`      | `OWNER`, `MEMBER`                              |

---

## API Design

### Auth Endpoints (`/auth`)

| Method | Endpoint                | Auth | Description                        |
| ------ | ----------------------- | ---- | ---------------------------------- |
| `POST` | `/auth/signup`          | No   | Register new user (email/password) |
| `POST` | `/auth/login`           | No   | Login with email/password          |
| `POST` | `/auth/google`          | No   | Google OAuth login (ID Token)      |
| `POST` | `/auth/google/code`     | No   | Google OAuth login (Auth Code)     |
| `POST` | `/auth/refresh`         | No   | Refresh access token               |
| `POST` | `/auth/logout`          | No   | Logout (revoke refresh token)      |
| `POST` | `/auth/logout-all`      | JWT  | Logout from all devices            |
| `POST` | `/auth/forgot-password` | No   | Request password reset email       |
| `POST` | `/auth/reset-password`  | No   | Reset password with token          |

### Paper Endpoints (`/papers`)

| Method   | Endpoint                     | Auth | Description                              |
| -------- | ---------------------------- | ---- | ---------------------------------------- |
| `POST`   | `/papers`                    | JWT  | Register uploaded PDF for AI analysis    |
| `GET`    | `/papers`                    | JWT  | List all user papers (cursor pagination) |
| `GET`    | `/papers/search?term=`       | JWT  | Semantic search across all user papers   |
| `GET`    | `/papers/:id`                | JWT  | Get paper detail (UUID or ragFileId)     |
| `DELETE` | `/papers/:id`                | JWT  | Delete a paper and all associated data   |
| `DELETE` | `/papers`                    | JWT  | Delete ALL papers owned by user          |
| `POST`   | `/papers/:id/summary`        | JWT  | Generate/get paper summary (LLM)         |
| `POST`   | `/papers/:id/related-papers` | JWT  | Find related arXiv papers                |

### Chat Endpoints (`/chat`)

| Method   | Endpoint                         | Auth | Description                              |
| -------- | -------------------------------- | ---- | ---------------------------------------- |
| `POST`   | `/chat/ask`                      | JWT  | Ask question about a paper (RAG)         |
| `POST`   | `/chat/send-message`             | JWT  | Send plain message (no AI, for collab)   |
| `POST`   | `/chat/generate`                 | JWT  | Freeform AI generation (notebook Ask AI) |
| `POST`   | `/chat/ask-multi`                | JWT  | Ask across multiple papers               |
| `GET`    | `/chat/messages/:conversationId` | JWT  | Get message history (cursor pagination)  |
| `POST`   | `/chat/explain-region`           | JWT  | Explain selected PDF region              |
| `DELETE` | `/chat/history/:conversationId`  | JWT  | Clear chat history                       |
| `POST`   | `/chat/reactions/toggle`         | JWT  | Toggle reaction on a message             |
| `POST`   | `/chat/reply`                    | JWT  | Reply to a specific message              |
| `POST`   | `/chat/delete-message`           | JWT  | Soft-delete a message                    |

### Conversation Endpoints (`/conversations`)

| Method   | Endpoint                                                    | Auth | Description                     |
| -------- | ----------------------------------------------------------- | ---- | ------------------------------- |
| `POST`   | `/conversations`                                            | JWT  | Create new conversation         |
| `GET`    | `/conversations`                                            | JWT  | List conversations (filterable) |
| `GET`    | `/conversations/:id`                                        | JWT  | Get conversation by ID          |
| `DELETE` | `/conversations/:id`                                        | JWT  | Delete conversation             |
| `POST`   | `/conversations/:id/suggested-questions`                    | JWT  | Generate suggested questions    |
| `GET`    | `/conversations/:id/suggested-questions`                    | JWT  | Get stored suggested questions  |
| `GET`    | `/conversations/:id/messages/:messageId/followup-questions` | JWT  | Get follow-up questions         |

### Session Endpoints (`/sessions`)

| Method   | Endpoint                                    | Auth | Description                                     |
| -------- | ------------------------------------------- | ---- | ----------------------------------------------- |
| `POST`   | `/sessions`                                 | JWT  | Start a collaborative session on a conversation |
| `POST`   | `/sessions/join`                            | JWT  | Join a session via invite token                 |
| `GET`    | `/sessions`                                 | JWT  | List user's collaborative sessions              |
| `GET`    | `/sessions/:conversationId`                 | JWT  | Get session details & members                   |
| `POST`   | `/sessions/:conversationId/leave`           | JWT  | Leave a session                                 |
| `DELETE` | `/sessions/:conversationId`                 | JWT  | End session (owner only)                        |
| `GET`    | `/sessions/:conversationId/members`         | JWT  | Get session members                             |
| `DELETE` | `/sessions/:conversationId/members/:userId` | JWT  | Remove member (owner only)                      |
| `POST`   | `/sessions/:conversationId/invites`         | JWT  | Create new invite link                          |
| `GET`    | `/sessions/:conversationId/invites/active`  | JWT  | Get current active invite                       |
| `POST`   | `/sessions/:conversationId/invites/reset`   | JWT  | Reset invite (revoke old, create new)           |
| `DELETE` | `/sessions/invites/:inviteToken`            | JWT  | Revoke invite link                              |
| `DELETE` | `/sessions/:conversationId/invites`         | JWT  | Delete all invites for session                  |

### Highlight & Comment Endpoints

| Method   | Endpoint                            | Auth | Description                    |
| -------- | ----------------------------------- | ---- | ------------------------------ |
| `POST`   | `/papers/:paperId/highlights`       | JWT  | Create highlight on a paper    |
| `GET`    | `/papers/:paperId/highlights`       | JWT  | Get highlights (optional page) |
| `GET`    | `/highlights/:id`                   | JWT  | Get highlight with comments    |
| `PATCH`  | `/highlights/:id`                   | JWT  | Update highlight (color)       |
| `DELETE` | `/highlights/:id`                   | JWT  | Delete highlight and comments  |
| `POST`   | `/highlights/:highlightId/comments` | JWT  | Add comment to highlight       |
| `GET`    | `/highlights/:highlightId/comments` | JWT  | Get comments for highlight     |
| `PATCH`  | `/comments/:id`                     | JWT  | Update a comment               |
| `DELETE` | `/comments/:id`                     | JWT  | Delete a comment               |

### Folder Endpoints (`/folders`)

| Method   | Endpoint                        | Auth | Description               |
| -------- | ------------------------------- | ---- | ------------------------- |
| `GET`    | `/folders`                      | JWT  | Get all folders           |
| `GET`    | `/folders/uncategorized`        | JWT  | Get papers without folder |
| `GET`    | `/folders/:id`                  | JWT  | Get folder with papers    |
| `POST`   | `/folders`                      | JWT  | Create folder             |
| `PUT`    | `/folders/:id`                  | JWT  | Update folder             |
| `DELETE` | `/folders/:id`                  | JWT  | Delete folder             |
| `PATCH`  | `/folders/papers/:paperId/move` | JWT  | Move paper to/from folder |

### Notebook Endpoints (`/notebooks`)

| Method   | Endpoint                    | Auth | Description                           |
| -------- | --------------------------- | ---- | ------------------------------------- |
| `GET`    | `/notebooks`                | JWT  | Get all user's notebooks              |
| `GET`    | `/notebooks/shared-with-me` | JWT  | Get notebooks shared with user        |
| `GET`    | `/notebooks/:id`            | JWT  | Get notebook with full content        |
| `POST`   | `/notebooks`                | JWT  | Create notebook                       |
| `PUT`    | `/notebooks/:id`            | JWT  | Update notebook (auto-save)           |
| `DELETE` | `/notebooks/:id`            | JWT  | Delete (owner) or hide (collaborator) |
| `POST`   | `/notebooks/:id/share`      | JWT  | Share notebook (create collab copy)   |
| `POST`   | `/notebooks/join/:token`    | JWT  | Join shared notebook via token        |
| `GET`    | `/notebooks/collab/:id`     | JWT  | Get collaborative notebook            |
| `PUT`    | `/notebooks/collab/:id`     | JWT  | Update collaborative notebook         |

### Upload Endpoints (`/upload`)

| Method | Endpoint        | Auth | Description          |
| ------ | --------------- | ---- | -------------------- |
| `POST` | `/upload/image` | JWT  | Upload single image  |
| `POST` | `/upload/pdf`   | JWT  | Upload single PDF    |
| `POST` | `/upload/pdfs`  | JWT  | Upload multiple PDFs |

### Guest Endpoints (`/guest`)

| Method | Endpoint                   | Auth | Description                     |
| ------ | -------------------------- | ---- | ------------------------------- |
| `POST` | `/guest/upload`            | No   | Upload PDF (anonymous)          |
| `GET`  | `/guest/status/:ragFileId` | No   | Check ingest status             |
| `POST` | `/guest/ask`               | No   | Ask question (anonymous)        |
| `POST` | `/guest/explain-region`    | No   | Explain PDF region (anonymous)  |
| `POST` | `/guest/migrate`           | JWT  | Migrate guest data to user acct |

### Health Check

| Method | Endpoint | Auth | Description  |
| ------ | -------- | ---- | ------------ |
| `GET`  | `/`      | No   | Health check |

### Endpoints with Collaborative Access

The following existing endpoints support collaborative access (session members can use them alongside the conversation owner):

| Endpoint                      | Change                                                       |
| ----------------------------- | ------------------------------------------------------------ |
| `GET /conversations/:id`      | Session members can view (not just owner)                    |
| `POST /chat/ask`              | Session members can send messages; messages include `userId` |
| `POST /chat/send-message`     | Session members can send plain messages                      |
| `GET /chat/messages/:id`      | Session members can read message history                     |
| `POST /papers/:id/highlights` | Session members can create highlights                        |
| `GET /papers/:id/highlights`  | Returns ALL highlights (all members) in session              |
| `GET /highlights/:id`         | Session members can view any highlight                       |

---

## WebSocket Events

### Session Gateway — Namespace: `/session`

**Connection:** JWT auth via `handshake.auth.token` or `Authorization` header.

```typescript
const socket = io('/session', {
  auth: { token: accessToken },
});
```

### Client → Server Events

| Event                  | Payload                                          | Description            |
| ---------------------- | ------------------------------------------------ | ---------------------- |
| `session:join`         | `{ conversationId }`                             | Join a session room    |
| `session:leave`        | `{ conversationId }`                             | Leave a session room   |
| `session:typing-start` | `{ conversationId }`                             | User started typing    |
| `session:typing-stop`  | `{ conversationId }`                             | User stopped typing    |
| `session:cursor-move`  | `{ conversationId, pageNumber, scrollPosition }` | PDF cursor/scroll sync |

### Server → Client Events

| Event                        | Payload                                                                                        | Description               |
| ---------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------- |
| `session:user-joined`        | `{ userId, displayName, avatarUrl, timestamp }`                                                | A user joined the session |
| `session:user-left`          | `{ userId, displayName, timestamp }`                                                           | A user left the session   |
| `session:new-message`        | `{ id, role, content, userId, displayName, avatarUrl, imageUrl, context, replyTo, createdAt }` | New chat message          |
| `session:typing`             | `{ userId, displayName, avatarUrl, isTyping }`                                                 | Typing indicator          |
| `session:cursor-move`        | `{ userId, displayName, pageNumber, scrollPosition }`                                          | Other user's PDF position |
| `session:assistant-thinking` | `{ isThinking }`                                                                               | AI processing indicator   |
| `session:highlight-added`    | `{ highlight }`                                                                                | New highlight created     |
| `session:highlight-updated`  | `{ highlight }`                                                                                | Highlight updated         |
| `session:highlight-deleted`  | `{ highlight }`                                                                                | Highlight deleted         |
| `session:comment-added`      | `{ comment }`                                                                                  | New comment on highlight  |
| `session:comment-updated`    | `{ comment }`                                                                                  | Comment updated           |
| `session:comment-deleted`    | `{ comment }`                                                                                  | Comment deleted           |
| `session:reaction-update`    | `{ messageId, reactions[], action, userId, emoji }`                                            | Reaction toggled          |
| `session:message-deleted`    | `{ messageId, userId }`                                                                        | Message soft-deleted      |
| `session:member-removed`     | `{ userId, timestamp }`                                                                        | Member removed by owner   |
| `session:ended`              | `{ timestamp }`                                                                                | Session ended by owner    |

### Yjs WebSocket Server (Standalone)

- **Port:** `1234` (default, configurable via `YJS_PORT` env)
- **Protocol:** Raw WebSocket (NOT Socket.IO)
- **Library:** `y-websocket` using `setupWSConnection`
- **Room mapping:** Notebook ID extracted from URL path: `ws://localhost:1234/{notebook-id}`
- **Health check:** `GET /` returns `"Yjs WebSocket Server running"` (200)
- **Purpose:** Real-time collaborative notebook editing using Yjs CRDT

---

## Backend Architecture

### Module Dependency Graph

```
AppModule
├── ConfigModule (global)              — Environment configuration
├── ScheduleModule                     — Cron-based scheduled tasks
├── PrismaModule (global)             — Database access layer
├── RagModule                         — HTTP client to RAG FastAPI service
│   └── RagService                    — ingest, query, queryMulti, explainRegion,
│                                       cleanup, brainstorm, followUp, relatedPapers,
│                                       summarize, generateText
├── UsersModule                       — User profile management (no controller)
│   └── UsersService
├── AuthModule                        — Authentication & authorization
│   ├── AuthController                — Login, signup, OAuth, refresh, password reset
│   ├── AuthService                   — JWT gen, bcrypt, token rotation
│   ├── JwtStrategy                   — Passport JWT validation
│   └── JwtAuthGuard                  — Route protection
├── UploadModule                      — File upload to cloud
│   ├── UploadController              — Upload PDF/image
│   ├── UploadService
│   └── S3Service                     — AWS S3 client
├── PaperModule                       — Paper lifecycle management
│   ├── PaperController               — CRUD, summary, related papers, search
│   └── PaperService
├── FolderModule                      — Library folder organization
│   ├── FolderController              — CRUD folders, move papers
│   └── FolderService
├── ConversationModule                — Conversation management
│   ├── ConversationController        — CRUD, suggested questions, follow-ups
│   └── ConversationService
├── ChatModule                        — AI Chat orchestration
│   ├── ChatController                — Ask, send, generate, reactions, replies
│   └── ChatService                   — RAG query routing, message persistence
├── SessionModule                     — Collaborative sessions
│   ├── SessionController             — Create/join/leave, invite management
│   ├── SessionService                — Session lifecycle, access control
│   └── SessionGateway                — WebSocket (Socket.IO) for real-time
├── HighlightModule                   — PDF annotations
│   ├── HighlightController           — CRUD highlights
│   ├── HighlightService
│   ├── CommentController             — CRUD comments
│   └── CommentService
├── NotebookModule                    — Rich-text notebooks
│   ├── NotebookController            — CRUD, share, join, collab
│   └── NotebookService
├── GuestModule                       — Anonymous user functionality
│   ├── GuestController               — Upload, ask, status, migrate
│   └── GuestService
├── EmailModule                       — Email dispatch
│   └── EmailService                  — Password reset via Resend API
└── CleanupModule                     — Scheduled background tasks
    └── CleanupService                — Cron: guest cleanup (hourly),
                                        orphaned S3 files (daily 3 AM)
```

### Access Control Matrix

| Action               | Non-collaborative | Collaborative: OWNER          | Collaborative: MEMBER |
| -------------------- | ----------------- | ----------------------------- | --------------------- |
| View conversation    | Owner only        | Yes                           | Yes                   |
| Send message         | Owner only        | Yes                           | Yes                   |
| View messages        | Owner only        | Yes                           | Yes                   |
| Create highlight     | Paper owner       | Yes                           | Yes                   |
| View highlights      | Paper owner       | All (all members' highlights) | All                   |
| Update highlight     | Creator only      | Creator only                  | Creator only          |
| Delete highlight     | Creator only      | Creator or session owner      | Creator only          |
| Comment on highlight | Paper owner       | Yes                           | Yes                   |
| Create invite        | N/A               | Yes                           | Yes                   |
| Revoke invite        | N/A               | Yes                           | No                    |
| Remove member        | N/A               | Yes                           | No                    |
| End session          | N/A               | Yes                           | No                    |

---

## Flow Diagrams

### Flow 1: Start Collaborative Session

```
Owner clicks "Start Group Session"
    │
    ▼
POST /sessions { conversationId }
    │
    ▼
┌──────────────────────────────────────┐
│ 1. Verify conversation ownership      │
│ 2. Generate session_code (8-char)     │
│ 3. Generate invite_token (64-char)    │
│ 4. Transaction:                       │
│    - Set is_collaborative = true      │
│    - Create SessionMember (OWNER)     │
│    - Create SessionInvite             │
│ 5. Return invite link                 │
└──────────────────────────────────────┘
    │
    ▼
Owner shares invite link
```

### Flow 2: Join via Invite Link

```
User clicks invite link → /session/join/{token}
    │
    ▼
POST /sessions/join { inviteToken }
    │
    ▼
┌──────────────────────────────────────┐
│ 1. Validate invite token              │
│    - Not expired?                     │
│    - Not revoked?                     │
│    - Under max uses?                  │
│ 2. Check member limit                 │
│ 3. Create SessionMember (MEMBER)      │
│ 4. Increment invite use_count         │
│ 5. Return session info + paper URL    │
└──────────────────────────────────────┘
    │
    ▼
User enters collaborative workspace
    │
    ▼
WebSocket: session:join { conversationId }
    │
    ▼
All members receive: session:user-joined
```

### Flow 3: Collaborative Chat Message

```
User types message → POST /chat/ask
    │
    ▼
┌──────────────────────────────────────┐
│ 1. Check access (owner OR member)     │
│ 2. Create user message (with userId)  │
│ 3. Broadcast user msg via WebSocket   │
│ 4. Broadcast assistant-thinking       │
│ 5. Call RAG service                   │
│ 6. Create assistant message           │
│ 7. Broadcast AI reply via WebSocket   │
└──────────────────────────────────────┘
    │
    ▼
All connected members see messages in real-time
```

### Flow 4: Shared Highlight

```
User selects text in PDF → POST /papers/:id/highlights
    │
    ▼
┌──────────────────────────────────────┐
│ 1. verifyPaperAccess()                │
│    - Paper owner? ✓                   │
│    - Session member? ✓                │
│ 2. Create highlight (with userId)     │
│ 3. Broadcast via WebSocket:           │
│    - session:highlight-added          │
└──────────────────────────────────────┘
    │
    ▼
All members see highlight appear on their PDF view
```

### Flow 5: Notebook Collaboration

```
Owner creates notebook → POST /notebooks
    │
    ▼
Owner shares → POST /notebooks/:id/share
    │
    ▼
┌──────────────────────────────────────────┐
│ 1. Create copy with isCollaborative=true  │
│ 2. Generate shareToken                    │
│ 3. Add owner as collaborator              │
│ 4. Return shareToken                      │
└──────────────────────────────────┬───────┘
                                   │
  Collaborator joins → POST /notebooks/join/:token
                                   │
                                   ▼
┌──────────────────────────────────────────┐
│ 1. Validate shareToken                    │
│ 2. Add user as collaborator               │
│ 3. If previously hidden → un-hide         │
│ 4. Return notebook info                   │
└──────────────────────────────────────────┘
    │
    ▼
Both users connect to: ws://localhost:1234/{notebook-id}
    │
    ▼
Yjs CRDT syncs edits in real-time
```

---

## Design Decisions

### Q: Should invite links expire?

**A: Yes.** Default **48 hours** with configurable duration (1h – 30 days). Prevents stale links from being used months later.

### Q: Should sessions be private by default?

**A: Yes.** Sessions are invite-only. There is no public discovery mechanism. Only users with a valid invite token can join.

### Q: Should the owner be able to remove members?

**A: Yes.** Owners can remove any member except themselves. Removed members' highlights and comments are preserved but they lose real-time access.

### Q: Should AI usage be limited per session?

**A: Not enforced at session level currently.** AI usage is rate-limited per user globally (existing system). A `token_count` on messages enables future per-session limits if needed.

### Q: Why not create a separate `sessions` table?

**A: Simplicity.** A session IS a collaborative conversation. Adding `is_collaborative`, `session_code`, and `max_members` to `conversations` avoids an unnecessary join and keeps the data model intuitive.

### Q: How does backward compatibility work?

**A:** When `is_collaborative = false` (default), everything works exactly as before — single user, single owner, no session membership checks. The new columns are nullable/defaulted and never read in non-collaborative paths.

### Q: Why a separate Yjs server instead of using Socket.IO?

**A:** The `y-websocket` library provides a battle-tested CRDT sync protocol. Integrating it into the NestJS Socket.IO gateway would add complexity without benefit. The standalone server runs on port 1234 and handles only notebook collaboration, keeping concerns cleanly separated.

### Q: Why copy notebooks on share instead of granting access to the original?

**A:** Creating a collaborative copy preserves the owner's original notebook state. The shared copy becomes a new collaborative document that all participants edit together via Yjs.

---

## Frontend Integration Guide

### 1. Session UI Components

```
┌──────────────────────────────────────────────┐
│ ConversationView                              │
│ ┌──────────────────────┐ ┌─────────────────┐ │
│ │   PDF Viewer          │ │  Chat Panel     │ │
│ │                       │ │                 │ │
│ │  [Shared Highlights]  │ │  [Messages]     │ │
│ │  [Cursor Indicators]  │ │  [User avatars] │ │
│ │                       │ │  [Typing...]    │ │
│ │                       │ │  [Reactions]    │ │
│ │                       │ │  [Replies]      │ │
│ └──────────────────────┘ └─────────────────┘ │
│ ┌──────────────────────────────────────────┐  │
│ │ Session Bar: [Members] [Invite] [Leave]  │  │
│ └──────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

### 2. WebSocket Integration

```typescript
// Frontend socket connection
import { io } from 'socket.io-client';

const socket = io('/session', {
  auth: { token: localStorage.getItem('accessToken') },
});

// Join session room
socket.emit('session:join', { conversationId });

// Listen for new messages
socket.on('session:new-message', (msg) => {
  addMessageToChat(msg);
});

// Listen for highlight events
socket.on('session:highlight-added', (highlight) => {
  addHighlightToPDF(highlight);
});

// Typing indicator
socket.on('session:typing', ({ userId, displayName, avatarUrl, isTyping }) => {
  setTypingIndicator(userId, displayName, isTyping);
});

// PDF cursor sync
socket.on('session:cursor-move', ({ userId, pageNumber, scrollPosition }) => {
  showUserCursorOnPDF(userId, pageNumber, scrollPosition);
});

// AI processing indicator
socket.on('session:assistant-thinking', ({ isThinking }) => {
  showThinkingIndicator(isThinking);
});

// Reaction updates
socket.on('session:reaction-update', ({ messageId, reactions }) => {
  updateMessageReactions(messageId, reactions);
});

// Message deletion
socket.on('session:message-deleted', ({ messageId }) => {
  removeMessageFromUI(messageId);
});
```

### 3. Notebook Collaboration (Yjs)

```typescript
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

const ydoc = new Y.Doc();
const provider = new WebsocketProvider(
  'ws://localhost:1234',
  notebookId, // room name = notebook UUID
  ydoc,
);

// Integrate with Tiptap editor
const editor = new Editor({
  extensions: [
    Collaboration.configure({ document: ydoc }),
    // ... other extensions
  ],
});
```

### 4. Invite Flow

```
Route: /session/join/:inviteToken

1. Extract inviteToken from URL
2. If user is logged in:
   → POST /sessions/join { inviteToken }
   → Redirect to collaborative workspace
3. If user is NOT logged in:
   → Redirect to login with ?returnUrl=/session/join/:token
   → After login, auto-join
```

### 5. Key Frontend Pages

| Route                  | Component            | Description                                              |
| ---------------------- | -------------------- | -------------------------------------------------------- |
| `/session/join/:token` | `JoinSessionPage`    | Handle invite link, authenticate & join                  |
| `/paper/:id`           | `ChatPage`           | PDF viewer + Chat, enhanced with session bar when collab |
| `/notebooks`           | `NotebookPage`       | List all notebooks (owned + shared)                      |
| `/notebooks/:id`       | `NotebookViewerPage` | Tiptap editor with optional Yjs collaboration            |

---

## File Structure

```
src/
├── app.module.ts              # Root module (16 modules + ConfigModule + ScheduleModule)
├── main.ts                    # Bootstrap: CORS, Swagger (/docs), ValidationPipe, Yjs server
│
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts     # Login, signup, OAuth, refresh, password reset
│   ├── auth.service.ts        # JWT generation, bcrypt, token rotation
│   ├── jwt.strategy.ts        # Passport JWT strategy
│   ├── jwt-auth.guard.ts      # Route protection guard
│   └── dto/                   # 12 DTOs (signup, login, google, refresh, password reset)
│
├── paper/
│   ├── paper.module.ts
│   ├── paper.controller.ts    # CRUD, summary, related papers, search
│   ├── paper.service.ts       # Upload flow, RAG integration
│   └── dto/
│
├── chat/
│   ├── chat.module.ts
│   ├── chat.controller.ts     # Ask, send-message, generate, ask-multi, reactions, replies
│   ├── chat.service.ts        # RAG query routing, WS broadcast
│   └── dto/                   # 12 DTOs
│
├── conversation/
│   ├── conversation.module.ts
│   ├── conversation.controller.ts  # CRUD, suggested questions, follow-ups
│   ├── conversation.service.ts
│   └── dto/
│
├── session/
│   ├── session.module.ts
│   ├── session.controller.ts  # Create/join/leave, invite management (13 endpoints)
│   ├── session.service.ts     # Session lifecycle, access control
│   ├── session.gateway.ts     # WebSocket (/session namespace)
│   └── dto/                   # create-session, join-session, create-invite, response DTOs
│
├── highlight/
│   ├── highlight.module.ts
│   ├── highlight.controller.ts    # CRUD highlights
│   ├── highlight.service.ts
│   ├── comment.controller.ts      # CRUD comments
│   ├── comment.service.ts
│   └── dto/
│
├── notebook/
│   ├── notebook.module.ts
│   ├── notebook.controller.ts     # CRUD, share, join, collab (10 endpoints)
│   ├── notebook.service.ts        # Share creates copy, join adds collaborator
│   └── dto/                       # create-notebook, update-notebook, response DTOs
│
├── folder/
│   ├── folder.module.ts
│   ├── folder.controller.ts       # CRUD folders, move papers (7 endpoints)
│   ├── folder.service.ts
│   └── dto/
│
├── upload/
│   ├── upload.module.ts
│   ├── upload.controller.ts       # Upload PDF/image
│   ├── upload.service.ts
│   ├── s3.service.ts              # AWS S3 client
│   └── dto/
│
├── rag/
│   ├── rag.module.ts
│   ├── rag.service.ts             # HTTP client to Pipeline_RAG (11 methods)
│   └── dto/                       # RAG request/response types
│
├── guest/
│   ├── guest.module.ts
│   ├── guest.controller.ts        # Upload, ask, status, explain-region, migrate
│   ├── guest.service.ts
│   └── dto/
│
├── users/
│   ├── users.module.ts
│   └── users.service.ts           # User CRUD (no controller)
│
├── email/
│   ├── email.module.ts
│   ├── email.service.ts           # Password reset emails
│   ├── providers/                 # Resend provider
│   ├── templates/                 # Email HTML templates
│   └── interfaces/
│
├── cleanup/
│   ├── cleanup.module.ts
│   └── cleanup.service.ts        # Cron: hourly guest cleanup, daily orphan check
│
├── prisma/
│   ├── prisma.module.ts
│   └── prisma.service.ts         # Database client wrapper
│
├── common/
│   ├── decorators/
│   │   └── current-user.decorator.ts  # @CurrentUser() decorator
│   ├── dto/
│   │   └── api-response.dto.ts        # ApiResponseDto, CursorPaginationDto
│   └── constants/
│
├── yjs-server.cjs                # Standalone Yjs WebSocket server (port 1234)
│
└── prisma/
    ├── schema.prisma             # Full database schema
    └── migrations/               # Database migrations
```

---

## Dependencies

### Runtime Dependencies

| Package                                                         | Purpose                          |
| --------------------------------------------------------------- | -------------------------------- |
| `@nestjs/core`, `@nestjs/common`, `@nestjs/config`              | NestJS framework                 |
| `@nestjs/jwt`, `passport`, `passport-jwt`                       | JWT authentication               |
| `@nestjs/swagger`                                               | API documentation (Swagger UI)   |
| `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io` | WebSocket gateway                |
| `@nestjs/schedule`                                              | Cron jobs (cleanup)              |
| `@nestjs/axios`, `axios`                                        | HTTP calls to RAG Python service |
| `@prisma/adapter-pg`, `pg`                                      | PostgreSQL via Prisma            |
| `@aws-sdk/client-s3`                                            | S3 file storage                  |
| `bcrypt`                                                        | Password hashing                 |
| `google-auth-library`                                           | Google OAuth verification        |
| `multer`                                                        | File upload handling             |
| `resend`                                                        | Email delivery (password reset)  |
| `class-validator`, `class-transformer`                          | DTO validation                   |
| `yjs`, `y-websocket`                                            | Real-time collaborative editing  |

### Engine Requirements

- Node.js ≥ 20.0.0
- npm ≥ 10.0.0
- PostgreSQL ≥ 12.0
