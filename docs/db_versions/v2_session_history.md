# Database Schema Update: Session History & isClosed Field

**Version:** 2.0 (Feature: Session History)
**Date:** March 2026

## Changes Made
- Added `is_closed` boolean column (default `false`) to the `conversations` table.
- No new tables or relationships required.

## Rationale
The Session History feature allows users to permanently close a chat session, preventing further messages. The `isClosed` flag is checked in `ChatService.askQuestion()` before processing any new user message — a closed session returns HTTP 400.

Additionally, session titles are now auto-generated on first message via a fire-and-forget LLM call (no schema change needed — the existing `title` column in `conversations` is reused).

## Schema Diff Summary
```prisma
model Conversation {
  // ... existing fields ...
+  isClosed  Boolean  @default(false) @map("is_closed")
}
```

## Migration
```bash
# Mark previous broken migration as applied (if shadow DB fails):
npx prisma migrate resolve --applied "20260310165643_add_user_role"

# Then apply the new migration:
npx prisma migrate dev --name add_is_closed_to_conversations

# OR use db push for development:
npx prisma db push && npx prisma generate
```
