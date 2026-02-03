-- ============================================================================
-- RAG SCIENTIFIC - INITIAL DATABASE SCHEMA
-- Version: 1.0.0
-- Created: 2026-02-03
-- Database: PostgreSQL
--
-- This migration creates the complete database schema for the RAG Scientific
-- application, including user management, paper storage, conversation history,
-- and caching for AI-generated content.
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Authentication provider type
CREATE TYPE "AuthProvider" AS ENUM ('LOCAL', 'GOOGLE');

-- Paper processing status (maps to RAG service states)
CREATE TYPE "PaperStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- Conversation type (single vs multi-paper chat)
CREATE TYPE "ConversationType" AS ENUM ('SINGLE_PAPER', 'MULTI_PAPER');

-- Message role in conversation
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT');

-- ============================================================================
-- TABLE: users
-- Core user account table with OAuth support
-- ============================================================================

CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,

    -- Local authentication (null for OAuth-only users)
    "password_hash" VARCHAR(255),

    -- OAuth provider info
    "provider" "AuthProvider" NOT NULL DEFAULT 'LOCAL',
    "provider_id" VARCHAR(255),

    -- User profile
    "display_name" VARCHAR(100),
    "avatar_url" VARCHAR(500),

    -- Account status
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ,

    -- Timestamps
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- Indexes for users
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_provider_provider_id_key" ON "users"("provider", "provider_id");
CREATE INDEX "users_email_idx" ON "users"("email");

-- ============================================================================
-- TABLE: refresh_tokens
-- JWT refresh token storage for secure authentication
-- ============================================================================

CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,

    -- Token data
    "token" VARCHAR(500) NOT NULL,
    "device_info" VARCHAR(500),
    "ip_address" VARCHAR(50),

    -- Token lifecycle
    "expires_at" TIMESTAMPTZ NOT NULL,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,

    -- Timestamps
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "refresh_tokens_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes for refresh_tokens
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- ============================================================================
-- TABLE: folders
-- Organize papers in user's library
-- ============================================================================

CREATE TABLE "folders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,

    -- Folder info
    "name" VARCHAR(100) NOT NULL,
    "order_index" INTEGER NOT NULL DEFAULT 0,

    -- Timestamps
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "folders_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes for folders
CREATE UNIQUE INDEX "folders_user_id_name_key" ON "folders"("user_id", "name");
CREATE INDEX "folders_user_id_idx" ON "folders"("user_id");
CREATE INDEX "folders_order_index_idx" ON "folders"("order_index");

-- ============================================================================
-- TABLE: papers
-- Core entity - PDF documents linked to RAG service
-- ============================================================================

CREATE TABLE "papers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "folder_id" UUID,

    -- File storage (S3/Cloud)
    "file_name" VARCHAR(255) NOT NULL,
    "file_url" VARCHAR(1000) NOT NULL,
    "file_size" BIGINT,
    "file_hash" VARCHAR(64),

    -- RAG service integration (critical field)
    "rag_file_id" VARCHAR(100) NOT NULL,

    -- Paper metadata (extracted by GROBID via RAG service)
    "title" VARCHAR(500),
    "abstract" TEXT,
    "authors" TEXT,
    "num_pages" INTEGER,

    -- Processing status
    "status" "PaperStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,

    -- Ingestion statistics from RAG service
    "node_count" INTEGER,
    "table_count" INTEGER,
    "image_count" INTEGER,

    -- Timestamps
    "processed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "papers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "papers_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "papers_folder_id_fkey"
        FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes for papers
CREATE UNIQUE INDEX "papers_rag_file_id_key" ON "papers"("rag_file_id");
CREATE INDEX "papers_user_id_idx" ON "papers"("user_id");
CREATE INDEX "papers_folder_id_idx" ON "papers"("folder_id");
CREATE INDEX "papers_rag_file_id_idx" ON "papers"("rag_file_id");
CREATE INDEX "papers_status_idx" ON "papers"("status");

-- ============================================================================
-- TABLE: conversations
-- Chat sessions with papers
-- ============================================================================

CREATE TABLE "conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "paper_id" UUID NOT NULL,

    -- Conversation metadata
    "title" VARCHAR(300),
    "type" "ConversationType" NOT NULL DEFAULT 'SINGLE_PAPER',

    -- Timestamps
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "conversations_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conversations_paper_id_fkey"
        FOREIGN KEY ("paper_id") REFERENCES "papers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes for conversations
CREATE INDEX "conversations_user_id_idx" ON "conversations"("user_id");
CREATE INDEX "conversations_paper_id_idx" ON "conversations"("paper_id");
CREATE INDEX "conversations_created_at_idx" ON "conversations"("created_at");
CREATE INDEX "conversations_type_idx" ON "conversations"("type");

-- ============================================================================
-- TABLE: conversation_papers
-- Join table for multi-paper conversations
-- ============================================================================

CREATE TABLE "conversation_papers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "paper_id" UUID NOT NULL,
    "order_index" INTEGER NOT NULL DEFAULT 0,

    -- Timestamps
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_papers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "conversation_papers_conversation_id_fkey"
        FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conversation_papers_paper_id_fkey"
        FOREIGN KEY ("paper_id") REFERENCES "papers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes for conversation_papers
CREATE UNIQUE INDEX "conversation_papers_conversation_id_paper_id_key"
    ON "conversation_papers"("conversation_id", "paper_id");
CREATE INDEX "conversation_papers_conversation_id_idx" ON "conversation_papers"("conversation_id");
CREATE INDEX "conversation_papers_paper_id_idx" ON "conversation_papers"("paper_id");

-- ============================================================================
-- TABLE: messages
-- Chat messages (user questions and AI answers)
-- ============================================================================

CREATE TABLE "messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,

    -- Message content
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,

    -- For USER messages with image selection
    "image_url" VARCHAR(1000),

    -- For ASSISTANT messages - AI response metadata
    "model_name" VARCHAR(100),
    "token_count" INTEGER,
    "context" JSONB DEFAULT '{}',

    -- Timestamps
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "messages_conversation_id_fkey"
        FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes for messages
CREATE INDEX "messages_conversation_id_idx" ON "messages"("conversation_id");
CREATE INDEX "messages_created_at_idx" ON "messages"("created_at");

-- ============================================================================
-- TABLE: suggested_questions
-- Cached AI-generated questions for papers (brainstorm feature)
-- ============================================================================

CREATE TABLE "suggested_questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "paper_id" UUID NOT NULL,

    -- Question data
    "question" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,

    -- Timestamps
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suggested_questions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "suggested_questions_paper_id_fkey"
        FOREIGN KEY ("paper_id") REFERENCES "papers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes for suggested_questions
CREATE INDEX "suggested_questions_paper_id_idx" ON "suggested_questions"("paper_id");

-- ============================================================================
-- TABLE: related_papers
-- Cached related papers from arXiv (via RAG service)
-- ============================================================================

CREATE TABLE "related_papers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "paper_id" UUID NOT NULL,

    -- arXiv paper info
    "arxiv_id" VARCHAR(50) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "abstract" TEXT NOT NULL,
    "authors" VARCHAR(255)[] NOT NULL,
    "categories" VARCHAR(50)[] NOT NULL,
    "url" VARCHAR(500) NOT NULL,

    -- Relevance scoring
    "score" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,

    -- Display & cache
    "order_index" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "related_papers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "related_papers_paper_id_fkey"
        FOREIGN KEY ("paper_id") REFERENCES "papers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes for related_papers
CREATE UNIQUE INDEX "related_papers_paper_id_arxiv_id_key" ON "related_papers"("paper_id", "arxiv_id");
CREATE INDEX "related_papers_paper_id_idx" ON "related_papers"("paper_id");

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE "users" IS 'User accounts with support for local and OAuth authentication';
COMMENT ON TABLE "refresh_tokens" IS 'JWT refresh tokens for secure session management';
COMMENT ON TABLE "folders" IS 'User-created folders for organizing papers in library';
COMMENT ON TABLE "papers" IS 'Uploaded PDF documents linked to RAG service for Q&A';
COMMENT ON TABLE "conversations" IS 'Chat sessions between user and AI about papers';
COMMENT ON TABLE "conversation_papers" IS 'Junction table linking multiple papers to a conversation';
COMMENT ON TABLE "messages" IS 'Individual messages in a conversation (questions and answers)';
COMMENT ON TABLE "suggested_questions" IS 'AI-generated question suggestions for papers';
COMMENT ON TABLE "related_papers" IS 'Cached related papers from arXiv discovery';

COMMENT ON COLUMN "papers"."rag_file_id" IS 'Critical: Maps to file_id in RAG_BE_02 service for all Q&A operations';
COMMENT ON COLUMN "papers"."status" IS 'Processing status synced with RAG service ingestion state';
COMMENT ON COLUMN "messages"."context" IS 'JSONB storing retrieved RAG context (texts, tables, images) for citations';
