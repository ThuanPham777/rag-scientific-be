-- Migration: Refactor SuggestedQuestion from Paper to Conversation
-- Also add FollowUpQuestion model on Message

-- Step 1: Drop existing suggested_questions data and FK
-- (old data was paper-based, not compatible with new conversation-based design)
DELETE FROM "suggested_questions";

-- Drop old index and FK
ALTER TABLE "suggested_questions" DROP CONSTRAINT IF EXISTS "suggested_questions_paper_id_fkey";
DROP INDEX IF EXISTS "suggested_questions_paper_id_idx";

-- Step 2: Replace paper_id column with conversation_id
ALTER TABLE "suggested_questions" DROP COLUMN "paper_id";
ALTER TABLE "suggested_questions" ADD COLUMN "conversation_id" UUID NOT NULL;

-- Add new FK and index
ALTER TABLE "suggested_questions" ADD CONSTRAINT "suggested_questions_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "suggested_questions_conversation_id_idx" ON "suggested_questions"("conversation_id");

-- Step 3: Create follow_up_questions table
CREATE TABLE "follow_up_questions"
(
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "message_id" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follow_up_questions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "follow_up_questions_message_id_idx" ON "follow_up_questions"("message_id");

ALTER TABLE "follow_up_questions" ADD CONSTRAINT "follow_up_questions_message_id_fkey"
  FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
