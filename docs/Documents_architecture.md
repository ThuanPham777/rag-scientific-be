# RAG Scientific Backend Architecture

The Backend service `rag-scientific-be` is built with **NestJS** and serves as the API gateway and core business logic layer for the RAG Scientific platform.

## 1. Overview
- **Tech Stack**: NestJS, TypeScript, Prisma (PostgreSQL), Swagger for API Docs.
- **WebSocket Server**: Uses `y-websocket` running on port `1234` for real-time collaborative notebook editing via CRDTs.
- **REST API**: Runs on port `3000` (default) with CORS enabled. Supports large payloads for PDF/image uploads.

## 2. Core Modules
Based on `src/app.module.ts`, the system is modularized into several domains:
- **Core Systems**: `ConfigModule`, `ScheduleModule`, `PrismaModule`.
- **User & Auth**: `UsersModule`, `AuthModule` (JWT, Google OAuth, Refresh Tokens).
- **File Management**: `UploadModule` (S3 integrations), `PaperModule`, `FolderModule`.
- **Chat & Conversation**: `ConversationModule`, `ChatModule` (AI chatting, single/multi paper, region explanation). 
  - *Multi-Paper Support*: Implemented via `ConversationPaper` join table allowing dynamic adding/removing of explicitly selected multiple PDFs within a single dialogue session.
- **Collaboration**: `SessionModule` (Collaborative sessions), `NotebookModule` (Rich-text collaborative notebooks), `HighlightModule` (PDF annotations & comments).
- **Integration**: `RagModule` (HTTP Client interacting with Python RAG Service).
- **Miscellaneous**: `GuestModule` (Anonymous flows), `CleanupModule` (Cron jobs for orphaned files/guests).

## 3. User Profile API (Added)
The `UsersModule` now exposes a REST controller with the following protected endpoints (JWT required):

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/users/me` | Returns user profile + dashboard statistics (papers, conversations, sessions, join date) |
| `PATCH` | `/users/me` | Updates `displayName` and/or `avatarUrl` |
| `PATCH` | `/users/me/password` | Changes password (LOCAL accounts only; requires old password verification) |

Dashboard stats are aggregated on-demand from existing `papers`, `conversations`, and `session_members` tables — no schema change required.

## 4. Admin API (Added)
The `AdminModule` provides endpoints exclusively for users with the `SUPERADMIN` role.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/admin/stats` | System-wide statistics (total users, active users, total PDFs) |
| `GET` | `/admin/users` | Paginated list of users |
| `GET` | `/admin/users/:id` | Single user detail including upload/chat stats |
| `POST` | `/admin/users` | Create a new user account (returns ID/Email) |
| `PATCH` | `/admin/users/:id/activate` | Activate a disabled user |
| `PATCH` | `/admin/users/:id/deactivate` | Deactivate a user (prevents login) |
| `POST` | `/admin/users/:id/reset-password`| Reset a local user's password to a generated temporary password |
| `DELETE`| `/admin/users/:id` | Permanently delete a user and their data |

## 5. Communication with Other Services
- **With Frontend**: REST API (port 3000), WebSocket (Socket.IO for chat/session on `/session` namespace), WebSocket (Yjs on port 1234 for notebooks).
- **With RAG Service**: HTTP requests to `Pipeline_RAG` (FastAPI) for embedding generation, LLM reasoning, content extraction, and vector searches.

## 6. Database
- Managed via `Prisma` with PostgreSQL.
- Entities include Users, Papers, Conversations, Messages, Sessions, Highlights, Notebooks.
- Includes collaborative fields (`session_code`, `is_collaborative`) to support multi-user real-time syncing.

The code aligns directly with the previously written `ARCHITECTURE.md`.

## 7. Session History API (Added)
The `ConversationModule` now exposes endpoints for managing and browsing a user's full chat session history.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/conversations/history` | Returns all conversations for the authenticated user with full stats: start time, last interaction, message count, paper list, collab members |
| `PATCH` | `/conversations/:id` | Rename a conversation title (owner only) |
| `PATCH` | `/conversations/:id/close` | Close a session — prevents any further messages from being sent |

### Key Service Methods (`ConversationService`)
- **`getConversationHistory(userId)`** — fetches owned + joined collaborative conversations, enriches each with last message timestamp (via a separate query), paper list, and active session members.
- **`updateConversationTitle(userId, id, title)`** — owner-guarded rename.
- **`closeConversation(userId, id)`** — sets `isClosed = true`; the chat endpoint returns 400 if the conversation is closed.
- **`generateAutoTitle(userId, conversationId)`** — fire-and-forget method that runs after the first user message via `ChatService.autoGenerateTitleIfNeeded()`. Builds a prompt from the paper title + first message and calls `RagService.generateTitle()` → `/generate` on the Python RAG service.

### Auto-Title Generation (`RagService`)
- New method `generateTitle(paperTitle, firstMessage)` posts a structured prompt to the RAG `/generate` endpoint.
- Returns ≤ 60-character title. Falls back to `"Chat about <paper>"` or `"New conversation"` on error.
- Never blocks the chat response — called as a background promise.

## 8. Database Schema (Updated)
- Managed via `Prisma` with PostgreSQL.
- Entities include Users, Papers, Conversations, Messages, Sessions, Highlights, Notebooks.
- Includes collaborative fields (`session_code`, `is_collaborative`) to support multi-user real-time syncing.
- **`is_closed` (Boolean, default `false`)** added to `conversations` — used by Session History to lock sessions.
