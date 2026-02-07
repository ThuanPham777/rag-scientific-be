-- ============================================================================
-- RAG SCIENTIFIC - COMPLETE DATABASE SCHEMA
--
-- This is the canonical, production-ready database schema.
-- Created: 2026-02-04
--
-- ARCHITECTURE:
-- - All tables created by this single migration (Prisma-managed)
-- - Backend (rag-scientific-be) owns: users, papers, conversations, etc.
-- - RAG service (RAG_BE_02) owns: rag_paper_cache, paper_content_summaries
-- - Both services share the same PostgreSQL database
-- - Coordination via `rag_file_id` UUID
--
-- DESIGN PRINCIPLES:
-- - Single source of truth: `papers` table owns all paper metadata
-- - No data duplication between services
-- - RAG tables are minimal (cache only)
-- ============================================================================

-- Enable UUID generation
CREATE EXTENSION
IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- SECTION 1: ENUMS
-- ============================================================================

-- Authentication provider types
CREATE TYPE "AuthProvider" AS ENUM
('LOCAL', 'GOOGLE');

-- Paper processing status
CREATE TYPE "PaperStatus" AS ENUM
('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- Chat message role
CREATE TYPE "MessageRole" AS ENUM
('USER', 'ASSISTANT');

-- Conversation type
CREATE TYPE "ConversationType" AS ENUM
('SINGLE_PAPER', 'MULTI_PAPER');

-- ============================================================================
-- SECTION 2: USER MANAGEMENT
-- ============================================================================

-- Users table - supports local and OAuth authentication
CREATE TABLE "users"
(
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,

    -- Local auth (nullable for OAuth users)
    "password_hash" VARCHAR(255),

    -- OAuth support
    "provider" "AuthProvider" NOT NULL DEFAULT 'LOCAL',
    "provider_id" VARCHAR(255),

    -- Profile
    "display_name" VARCHAR(100),
    "avatar_url" VARCHAR(500),

    -- Status
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ,

    -- Timestamps
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "users_email_key" UNIQUE ("email"),
    CONSTRAINT "users_provider_provider_id_key" UNIQUE ("provider", "provider_id")
);

CREATE INDEX "users_email_idx" ON "users"("email");

-- Refresh tokens for JWT authentication
CREATE TABLE "refresh_tokens"
(
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,

    "token" VARCHAR(500) NOT NULL,
    "device_info" VARCHAR(500),
    "ip_address" VARCHAR(50),

    "expires_at" TIMESTAMPTZ NOT NULL,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,

    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "refresh_tokens_token_key" UNIQUE ("token"),
    CONSTRAINT "refresh_tokens_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- ============================================================================
-- SECTION 3: FOLDER MANAGEMENT
-- ============================================================================

-- Folders for organizing papers in user's library
CREATE TABLE "folders"
(
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,

    "name" VARCHAR(100) NOT NULL,
    "order_index" INTEGER NOT NULL DEFAULT 0,

    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "folders_user_id_name_key" UNIQUE ("user_id", "name"),
    CONSTRAINT "folders_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX "folders_user_id_idx" ON "folders"("user_id");
CREATE INDEX "folders_order_index_idx" ON "folders"("order_index");

-- ============================================================================
-- SECTION 4: PAPERS (SINGLE SOURCE OF TRUTH)
--
-- This is THE authoritative table for all paper data.
-- Backend owns this table and updates it based on RAG responses.
-- RAG service reads from this table when needed.
-- ============================================================================

CREATE TABLE "papers"
(
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "folder_id" UUID,

    -- === File Storage (Cloud) ===
    "file_name" VARCHAR(255) NOT NULL,
    -- Original filename
    "file_url" VARCHAR(1000) NOT NULL,
    -- S3/Cloud URL (SINGLE SOURCE)
    "file_size" BIGINT,
    -- File size in bytes
    "file_hash" VARCHAR(64),
    -- MD5 hash for deduplication

    -- === RAG Service Integration ===
    "rag_file_id" VARCHAR(100) NOT NULL,
    -- UUID linking to RAG service

    -- === Metadata (extracted by RAG, stored here as source of truth) ===
    "title" VARCHAR(500),
    -- From GROBID extraction
    "abstract" TEXT,
    -- From GROBID extraction
    "authors" TEXT,
    -- JSON array of author names
    "num_pages" INTEGER,
    -- Number of pages

    -- === Processing Status ===
    "status" "PaperStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    -- Error details if failed

    -- === Ingestion Statistics (from RAG) ===
    "node_count" INTEGER,
    -- Number of text chunks
    "table_count" INTEGER,
    -- Number of tables extracted
    "image_count" INTEGER,
    -- Number of images extracted

    -- === Timestamps ===
    "processed_at" TIMESTAMPTZ,
    -- When RAG finished processing
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "papers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "papers_rag_file_id_key" UNIQUE ("rag_file_id"),
    CONSTRAINT "papers_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "papers_folder_id_fkey"
        FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE SET NULL
);

CREATE INDEX "papers_user_id_idx" ON "papers"("user_id");
CREATE INDEX "papers_folder_id_idx" ON "papers"("folder_id");
CREATE INDEX "papers_rag_file_id_idx" ON "papers"("rag_file_id");
CREATE INDEX "papers_status_idx" ON "papers"("status");

-- ============================================================================
-- SECTION 5: CONVERSATIONS & MESSAGES
-- ============================================================================

-- Conversations - chat sessions with papers
CREATE TABLE "conversations"
(
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "paper_id" UUID NOT NULL,

    "title" VARCHAR(300),
    "type" "ConversationType" NOT NULL DEFAULT 'SINGLE_PAPER',

    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "conversations_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "conversations_paper_id_fkey"
        FOREIGN KEY ("paper_id") REFERENCES "papers"("id") ON DELETE CASCADE
);

CREATE INDEX "conversations_user_id_idx" ON "conversations"("user_id");
CREATE INDEX "conversations_paper_id_idx" ON "conversations"("paper_id");
CREATE INDEX "conversations_created_at_idx" ON "conversations"("created_at");
CREATE INDEX "conversations_type_idx" ON "conversations"("type");

-- Join table for multi-paper conversations
CREATE TABLE "conversation_papers"
(
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "paper_id" UUID NOT NULL,
    "order_index" INTEGER NOT NULL DEFAULT 0,

    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_papers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "conversation_papers_conversation_id_paper_id_key"
        UNIQUE ("conversation_id", "paper_id"),
    CONSTRAINT "conversation_papers_conversation_id_fkey"
        FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE,
    CONSTRAINT "conversation_papers_paper_id_fkey"
        FOREIGN KEY ("paper_id") REFERENCES "papers"("id") ON DELETE CASCADE
);

CREATE INDEX "conversation_papers_conversation_id_idx" ON "conversation_papers"("conversation_id");
CREATE INDEX "conversation_papers_paper_id_idx" ON "conversation_papers"("paper_id");

-- Messages - individual chat messages
CREATE TABLE "messages"
(
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,

    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,

    -- For USER messages with image (explain region feature)
    "image_url" VARCHAR(1000),

    -- For ASSISTANT messages - RAG response metadata
    "model_name" VARCHAR(100),
    "token_count" INTEGER,
    "context" JSONB DEFAULT '{}',
    -- Retrieved context from RAG

    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "messages_conversation_id_fkey"
        FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE
);

CREATE INDEX "messages_conversation_id_idx" ON "messages"("conversation_id");
CREATE INDEX "messages_created_at_idx" ON "messages"("created_at");

-- ============================================================================
-- SECTION 6: SUGGESTED QUESTIONS (Brainstorm feature)
-- ============================================================================

CREATE TABLE "suggested_questions"
(
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "paper_id" UUID NOT NULL,

    "question" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,

    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suggested_questions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "suggested_questions_paper_id_fkey"
        FOREIGN KEY ("paper_id") REFERENCES "papers"("id") ON DELETE CASCADE
);

CREATE INDEX "suggested_questions_paper_id_idx" ON "suggested_questions"("paper_id");

-- ============================================================================
-- SECTION 7: RELATED PAPERS (arXiv cache)
-- ============================================================================

CREATE TABLE "related_papers"
(
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "paper_id" UUID NOT NULL,

    -- arXiv paper info
    "arxiv_id" VARCHAR(50) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "abstract" TEXT NOT NULL,
    "authors" VARCHAR(255)
    [] NOT NULL,
    "categories" VARCHAR
    (50)[] NOT NULL,
    "url" VARCHAR
    (500) NOT NULL,

    -- Relevance
    "score" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,

    -- Cache control
    "order_index" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "related_papers_pkey" PRIMARY KEY
    ("id"),
    CONSTRAINT "related_papers_paper_id_arxiv_id_key" UNIQUE
    ("paper_id", "arxiv_id"),
    CONSTRAINT "related_papers_paper_id_fkey"
        FOREIGN KEY
    ("paper_id") REFERENCES "papers"
    ("id") ON
    DELETE CASCADE
);

    CREATE INDEX "related_papers_paper_id_idx" ON "related_papers"("paper_id");

    -- ============================================================================
    -- SECTION 8: RAG SERVICE TABLES
    --
    -- These tables are owned by RAG_BE_02 but created here for consistency.
    -- RAG service reads/writes these tables directly via psycopg2.
    --
    -- IMPORTANT: These are MINIMAL tables for RAG-specific operational needs.
    -- NO duplication of data that exists in `papers` table.
    -- ============================================================================

    -- RAG Paper Cache: Minimal processing state for RAG service
    -- Purpose: Track file hash for rebuild detection, NOT for storing metadata
    CREATE TABLE "rag_paper_cache"
    (
        -- Primary key: links to papers.rag_file_id
        "rag_paper_id" VARCHAR(100) NOT NULL,

        -- File hash for rebuild detection (different purpose than papers.file_hash)
        -- papers.file_hash = for deduplication at upload time
        -- rag_paper_cache.file_content_hash = for detecting if re-ingestion needed
        "file_content_hash" VARCHAR(64),

        -- Timestamps
        "last_processed_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT "rag_paper_cache_pkey" PRIMARY KEY ("rag_paper_id")
    );

    COMMENT ON TABLE "rag_paper_cache" IS
    'Minimal RAG processing cache. Owned by RAG_BE_02. Does NOT duplicate papers data.';

    -- Paper Content Summaries: Cache for expensive LLM-generated summaries
    -- Purpose: Avoid re-generating table/image summaries on every query
    CREATE TABLE "paper_content_summaries"
    (
        "id" SERIAL PRIMARY KEY,

        -- Links to rag_paper_cache
        "rag_paper_id" VARCHAR(100) NOT NULL,

        -- Content identification
        "content_type" VARCHAR(20) NOT NULL,
        -- 'table' or 'image'
        "content_index" INTEGER NOT NULL,
        -- Position in extraction order
        "content_hash" VARCHAR(64) NOT NULL,
        -- Hash for cache invalidation

        -- The cached summary
        "summary_text" TEXT NOT NULL,

        -- Timestamps
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

        -- One summary per content item per paper
        CONSTRAINT "paper_content_summaries_unique"
        UNIQUE ("rag_paper_id", "content_type", "content_index"),
        CONSTRAINT "paper_content_summaries_content_type_check"
        CHECK ("content_type" IN ('table', 'image'))
    );

    CREATE INDEX "paper_content_summaries_rag_paper_id_idx"
    ON "paper_content_summaries"("rag_paper_id");
    CREATE INDEX "paper_content_summaries_type_idx"
    ON "paper_content_summaries"("rag_paper_id", "content_type");

    COMMENT ON TABLE "paper_content_summaries" IS
    'Caches LLM-generated summaries for tables and images. Owned by RAG_BE_02.';

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
