# Database Schema Update: Multi-PDF Chat Support

**Version:** 1.0 (Feature: Multi-PDF Chat)
**Date:** March 2026

## Changes Made
- Added a new join table `ConversationPaper` (`conversation_papers` in PostgreSQL).
- Added one-to-many relationship `conversationPapers` to both `Conversation` and `Paper` models.

## Rationale
To support the "Multi-PDF Chat" feature where users can add multiple papers to a single chat session (appearing as tabs in the UI), we need a way to persist which papers are currently active in a `MULTI_PAPER` conversation. Previously, multi-paper routing was handled statelessly via REST parameters, but a persistent UI requires database state.

The `tabOrder` field is included to preserve the order of the PDF tabs as arranged by the user.

## Schema Diff Summary
```prisma
model ConversationPaper {
  id              String       @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  conversationId  String       @map("conversation_id") @db.Uuid
  paperId         String       @map("paper_id") @db.Uuid
  tabOrder        Int          @default(0) @map("tab_order")
  createdAt       DateTime     @default(now()) @map("created_at") @db.Timestamptz

  conversation    Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  paper           Paper        @relation(fields: [paperId], references: [id], onDelete: Cascade)

  @@unique([conversationId, paperId])
  @@map("conversation_papers")
}
```
