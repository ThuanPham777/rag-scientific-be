# Collaborative PDF Chat Workspace — Architecture Documentation

## Table of Contents

1. [Overview](#overview)
2. [ERD & Schema Design](#erd--schema-design)
3. [New Database Tables](#new-database-tables)
4. [Modified Database Tables](#modified-database-tables)
5. [API Design](#api-design)
6. [WebSocket Events](#websocket-events)
7. [Backend Architecture](#backend-architecture)
8. [Flow Diagrams](#flow-diagrams)
9. [Design Decisions](#design-decisions)
10. [Frontend Integration Guide](#frontend-integration-guide)
11. [File Structure](#file-structure)

---

## Overview

The system has been upgraded from a **single-user conversation model** to a **collaborative session model** where multiple users can:

- **Chat together** around a PDF paper in real-time
- **Annotate PDFs** with highlights and comments visible to all session members
- **Trigger AI responses** via `@assistant` mentions in the shared chat
- **Manage sessions** with invite links, role-based permissions, and member management

### Key Concepts

| Concept                | Description                                                |
| ---------------------- | ---------------------------------------------------------- |
| **Session**            | A collaborative mode activated on an existing conversation |
| **Session Code**       | 8-char unique identifier for a session (e.g., `A1B2C3D4`)  |
| **Invite Token**       | 64-char hex token used in shareable links                  |
| **Session Member**     | A user who has joined a session (OWNER or MEMBER)          |
| **Shared Annotations** | Highlights and comments visible to all session members     |

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
└──┬──┬──┬──┬─────┘
   │  │  │  │
   │  │  │  │ 1:N                    1:N
   │  │  │  ├───────────────────────────────────┐
   │  │  │  │                                   │
   │  │  │  ▼                                   ▼
   │  │  │ ┌──────────────────┐   ┌──────────────────────┐
   │  │  │ │ session_members  │   │   session_invites    │
   │  │  │ ├──────────────────┤   ├──────────────────────┤
   │  │  │ │ id (PK)          │   │ id (PK)              │
   │  │  │ │ conversation_id  │──┐│ conversation_id (FK) │──┐
   │  │  │ │ user_id (FK)     │  ││ invited_by (FK)      │  │
   │  │  │ │ role (ENUM)      │  ││ invite_token (UQ)    │  │
   │  │  │ │ is_active        │  ││ expires_at           │  │
   │  │  │ │ joined_at        │  ││ max_uses             │  │
   │  │  │ │ left_at          │  ││ use_count            │  │
   │  │  │ └──────────────────┘  ││ is_revoked           │  │
   │  │  │                       │└──────────────────────┘  │
   │  │  │         ┌─────────────┘                          │
   │  │  │         │  ┌────────────────────────────────────┘
   │  │  │         ▼  ▼
   │  │  │ ┌───────────────────┐
   │  │  │ │  conversations    │ ◄── UPGRADED
   │  │  │ ├───────────────────┤
   │  │  │ │ id (PK)           │
   │  │  │ │ user_id (FK)      │ ◄── Original owner
   │  │  │ │ paper_id (FK)     │
   │  │  │ │ title             │
   │  │  │ │ type              │
   │  │  │ │ is_collaborative  │ ◄── NEW
   │  │  │ │ session_code      │ ◄── NEW (unique)
   │  │  │ │ max_members       │ ◄── NEW
   │  │  │ └────────┬──────────┘
   │  │  │          │
   │  │  │          │ 1:N
   │  │  │          ▼
   │  │  │ ┌───────────────────┐
   │  │  │ │    messages       │ ◄── UPGRADED
   │  │  │ ├───────────────────┤
   │  │  │ │ id (PK)           │
   │  │  │ │ conversation_id   │
   │  │  │ │ user_id (FK)      │ ◄── NEW (who sent it)
   │  │  │ │ role              │
   │  │  │ │ content           │
   │  │  │ │ ...               │
   │  │  │ └───────────────────┘
   │  │  │
   │  │  │         ┌─────────────┐
   │  │  │         │   papers    │
   │  │  │         ├─────────────┤
   │  │  └────────▶│ id (PK)     │
   │  │            │ user_id     │
   │  │            │ ...         │
   │  │            └──────┬──────┘
   │  │                   │ 1:N
   │  │                   ▼
   │  │         ┌──────────────────┐
   │  └────────▶│   highlights     │
   │            ├──────────────────┤
   │            │ id (PK)          │
   │            │ paper_id (FK)    │
   │            │ user_id (FK)     │ ◄── Creator (shared visibility)
   │            │ page_number      │
   │            │ color            │
   │            │ ...              │
   │            └────────┬─────────┘
   │                     │ 1:N
   │                     ▼
   │         ┌──────────────────────┐
   └────────▶│ highlight_comments   │
             ├──────────────────────┤
             │ id (PK)              │
             │ highlight_id (FK)    │
             │ user_id (FK)         │ ◄── Any session member can comment
             │ content              │
             └──────────────────────┘
```

---

## New Database Tables

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

### `SessionRole` Enum

```sql
CREATE TYPE "SessionRole" AS ENUM ('OWNER', 'MEMBER');
```

---

## Modified Database Tables

### `conversations` (3 new columns)

| New Column         | Type        | Default | Description                                          |
| ------------------ | ----------- | ------- | ---------------------------------------------------- |
| `is_collaborative` | BOOLEAN     | `false` | Whether this conversation is a collaborative session |
| `session_code`     | VARCHAR(20) | `null`  | Unique session code (e.g., `A1B2C3D4`)               |
| `max_members`      | INTEGER     | `10`    | Maximum number of members allowed                    |

### `messages` (1 new column)

| New Column | Type      | Default | Description                                             |
| ---------- | --------- | ------- | ------------------------------------------------------- |
| `user_id`  | UUID (FK) | `null`  | References `users.id` — identifies who sent the message |

This is nullable for backward compatibility (ASSISTANT messages) and to support existing data.

---

## API Design

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
| `DELETE` | `/sessions/invites/:inviteToken`            | JWT  | Revoke invite (owner only)                      |

### Request/Response Examples

#### POST `/sessions` — Start Collaborative Session

```json
// Request
{
  "conversationId": "uuid-of-conversation",
  "maxMembers": 10
}

// Response
{
  "success": true,
  "data": {
    "conversationId": "uuid",
    "sessionCode": "A1B2C3D4",
    "inviteLink": "https://app.example.com/session/join/abc123...",
    "inviteToken": "abc123...",
    "expiresAt": "2026-02-15T12:00:00Z",
    "maxMembers": 10
  }
}
```

#### POST `/sessions/join` — Join Session

```json
// Request
{
  "inviteToken": "abc123..."
}

// Response
{
  "success": true,
  "data": {
    "conversationId": "uuid",
    "sessionCode": "A1B2C3D4",
    "role": "MEMBER",
    "paperId": "uuid",
    "paperTitle": "Deep Learning for NLP",
    "paperUrl": "https://s3.../paper.pdf",
    "members": [
      {
        "userId": "uuid",
        "displayName": "John",
        "avatarUrl": "https://...",
        "role": "OWNER",
        "joinedAt": "...",
        "isActive": true
      }
    ]
  }
}
```

### Existing Endpoints — Updated Behavior

The following existing endpoints now support collaborative access:

| Endpoint                      | Change                                                       |
| ----------------------------- | ------------------------------------------------------------ |
| `GET /conversations/:id`      | Session members can view (not just owner)                    |
| `POST /chat/ask`              | Session members can send messages; messages include `userId` |
| `GET /chat/messages/:id`      | Session members can read message history                     |
| `POST /papers/:id/highlights` | Session members can create highlights                        |
| `GET /papers/:id/highlights`  | Returns ALL highlights (all members) in session              |
| `GET /highlights/:id`         | Session members can view any highlight                       |

---

## WebSocket Events

### Connection

```
Namespace: /session
Auth: { token: "jwt-token" } in handshake
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

| Event                       | Payload                                               | Description               |
| --------------------------- | ----------------------------------------------------- | ------------------------- |
| `session:user-joined`       | `{ userId, displayName, avatarUrl, timestamp }`       | A user joined the session |
| `session:user-left`         | `{ userId, displayName, timestamp }`                  | A user left the session   |
| `session:new-message`       | `{ id, role, content, userId, displayName, ... }`     | New chat message          |
| `session:typing`            | `{ userId, displayName, isTyping }`                   | Typing indicator          |
| `session:highlight-added`   | `{ highlight }`                                       | New highlight created     |
| `session:highlight-updated` | `{ highlight }`                                       | Highlight updated         |
| `session:highlight-deleted` | `{ id }`                                              | Highlight deleted         |
| `session:comment-added`     | `{ comment }`                                         | New comment on highlight  |
| `session:member-removed`    | `{ userId, timestamp }`                               | Member removed by owner   |
| `session:ended`             | `{ timestamp }`                                       | Session ended by owner    |
| `session:cursor-move`       | `{ userId, displayName, pageNumber, scrollPosition }` | Other user's PDF position |

---

## Backend Architecture

### Module Dependency Graph

```
AppModule
├── PrismaModule (global)
├── SessionModule ◄── NEW
│   ├── SessionService
│   ├── SessionController
│   └── SessionGateway (WebSocket)
├── ChatModule
│   ├── ChatService ← imports SessionModule
│   └── ChatController
├── ConversationModule
│   ├── ConversationService ← imports SessionModule
│   └── ConversationController
├── HighlightModule
│   ├── HighlightService ← imports SessionModule
│   └── HighlightController
├── AuthModule
├── PaperModule
├── UploadModule
├── FolderModule
├── GuestModule
├── CleanupModule
└── RagModule
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
│ 3. Call RAG service                   │
│ 4. Create assistant message           │
│ 5. Broadcast via WebSocket:           │
│    - session:new-message (user msg)   │
│    - session:new-message (AI reply)   │
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
│ │                       │ │                 │ │
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
socket.on('session:typing', ({ userId, displayName, isTyping }) => {
  setTypingIndicator(userId, displayName, isTyping);
});

// PDF cursor sync
socket.on('session:cursor-move', ({ userId, pageNumber, scrollPosition }) => {
  showUserCursorOnPDF(userId, pageNumber, scrollPosition);
});
```

### 3. Invite Flow

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

### 4. Key Frontend Pages

| Route                  | Component         | Description                                                 |
| ---------------------- | ----------------- | ----------------------------------------------------------- |
| `/session/join/:token` | `JoinSessionPage` | Handle invite link, authenticate & join                     |
| `/paper/:id`           | `PaperView`       | Existing view, enhanced with session bar when collaborative |
| `/sessions`            | `SessionListPage` | List all active collaborative sessions                      |

---

## File Structure

```
src/session/
├── session.module.ts          # NestJS module definition
├── session.service.ts         # Business logic for sessions
├── session.controller.ts      # REST API endpoints
├── session.gateway.ts         # WebSocket gateway for real-time
└── dto/
    ├── index.ts
    ├── create-session.dto.ts  # Start session request/response
    ├── join-session.dto.ts    # Join session request/response
    ├── create-invite.dto.ts   # Invite creation request
    └── session-response.dto.ts # All response DTOs

# Modified files:
src/chat/chat.module.ts        # Import SessionModule
src/chat/chat.service.ts       # Collaborative access + broadcast
src/conversation/conversation.module.ts  # Import SessionModule
src/conversation/conversation.service.ts # Collaborative access
src/highlight/highlight.module.ts        # Import SessionModule
src/highlight/highlight.service.ts       # Shared highlights + broadcast
src/app.module.ts              # Register SessionModule

# Schema files:
prisma/schema.prisma           # New models + modified models
prisma/migrations/20260212120000_init/migration.sql  # Updated SQL
```

---

## Dependencies Required

```bash
# WebSocket support (if not already installed)
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io

# Frontend
npm install socket.io-client
```
