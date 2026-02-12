-- ============================================================================
-- RAG SCIENTIFIC - CONSOLIDATED INITIAL MIGRATION
-- Generated: 2026-02-12
--
-- This creates the complete database schema from scratch.
-- Database: PostgreSQL
-- ============================================================================

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE "AuthProvider" AS ENUM
('LOCAL', 'GOOGLE');
CREATE TYPE "PaperStatus" AS ENUM
('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "ConversationType" AS ENUM
('SINGLE_PAPER', 'MULTI_PAPER');
CREATE TYPE "MessageRole" AS ENUM
('USER', 'ASSISTANT');
CREATE TYPE "HighlightColor" AS ENUM
('YELLOW', 'GREEN', 'BLUE', 'PINK', 'ORANGE');

-- ============================================================================
-- TABLE: users
-- ============================================================================

CREATE TABLE "users"
(
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255),
    "provider" "AuthProvider" NOT NULL DEFAULT 'LOCAL',
    "provider_id" VARCHAR(255),
    "display_name" VARCHAR(100),
    "avatar_url" VARCHAR(500),
    "password_reset_token" VARCHAR(255),
    "password_reset_expires_at" TIMESTAMPTZ,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_provider_provider_id_key" ON "users"("provider", "provider_id");
CREATE INDEX "users_email_idx" ON "users"("email");

-- ============================================================================
-- TABLE: refresh_tokens
-- ============================================================================

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

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- ============================================================================
-- TABLE: folders
-- ============================================================================

CREATE TABLE "folders"
(
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "folders_user_id_name_key" ON "folders"("user_id", "name");
CREATE INDEX "folders_user_id_idx" ON "folders"("user_id");
CREATE INDEX "folders_order_index_idx" ON "folders"("order_index");

-- ============================================================================
-- TABLE: papers
-- ============================================================================

CREATE TABLE "papers"
(
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "folder_id" UUID,
    "file_name" VARCHAR(255) NOT NULL,
    "file_url" VARCHAR(1000) NOT NULL,
    "file_size" BIGINT,
    "file_hash" VARCHAR(64),
    "rag_file_id" VARCHAR(100) NOT NULL,
    "title" VARCHAR(500),
    "abstract" TEXT,
    "authors" TEXT,
    "summary" TEXT,
    "num_pages" INTEGER,
    "status" "PaperStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "node_count" INTEGER,
    "table_count" INTEGER,
    "image_count" INTEGER,
    "processed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "papers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "papers_rag_file_id_key" ON "papers"("rag_file_id");
CREATE INDEX "papers_user_id_idx" ON "papers"("user_id");
CREATE INDEX "papers_folder_id_idx" ON "papers"("folder_id");
CREATE INDEX "papers_rag_file_id_idx" ON "papers"("rag_file_id");
CREATE INDEX "papers_status_idx" ON "papers"("status");

-- ============================================================================
-- TABLE: conversations
-- paper_id is NULLABLE — NULL for MULTI_PAPER conversations
-- ============================================================================

CREATE TABLE "conversations"
(
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "paper_id" UUID,
    "title" VARCHAR(300),
    "type" "ConversationType" NOT NULL DEFAULT 'SINGLE_PAPER',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "conversations_user_id_idx" ON "conversations"("user_id");
CREATE INDEX "conversations_paper_id_idx" ON "conversations"("paper_id");
CREATE INDEX "conversations_created_at_idx" ON "conversations"("created_at");
CREATE INDEX "conversations_type_idx" ON "conversations"("type");

-- ============================================================================
-- TABLE: messages
-- ============================================================================

CREATE TABLE "messages"
(
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "image_url" VARCHAR(1000),
    "model_name" VARCHAR(100),
    "token_count" INTEGER,
    "context" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "messages_conversation_id_idx" ON "messages"("conversation_id");
CREATE INDEX "messages_created_at_idx" ON "messages"("created_at");

-- ============================================================================
-- TABLE: suggested_questions
-- ============================================================================

CREATE TABLE "suggested_questions"
(
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suggested_questions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "suggested_questions_conversation_id_idx" ON "suggested_questions"("conversation_id");

-- ============================================================================
-- TABLE: related_papers
-- ============================================================================

CREATE TABLE "related_papers"
(
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "paper_id" UUID NOT NULL,
    "arxiv_id" VARCHAR(50) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "abstract" TEXT NOT NULL,
    "authors" VARCHAR(255)
    [] NOT NULL,
    "categories" VARCHAR
    (50)[] NOT NULL,
    "url" VARCHAR
    (500) NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "related_papers_pkey" PRIMARY KEY
    ("id")
);

    CREATE UNIQUE INDEX "related_papers_paper_id_arxiv_id_key" ON "related_papers"("paper_id", "arxiv_id");
    CREATE INDEX "related_papers_paper_id_idx" ON "related_papers"("paper_id");

    -- ============================================================================
    -- TABLE: highlights
    -- ============================================================================

    CREATE TABLE "highlights"
    (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "paper_id" UUID NOT NULL,
        "user_id" UUID NOT NULL,
        "page_number" INTEGER NOT NULL,
        "selection_rects" JSONB NOT NULL,
        "selected_text" TEXT NOT NULL,
        "text_prefix" VARCHAR(100),
        "text_suffix" VARCHAR(100),
        "color" "HighlightColor" NOT NULL DEFAULT 'YELLOW',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL,

        CONSTRAINT "highlights_pkey" PRIMARY KEY ("id")
    );

    CREATE INDEX "highlights_paper_id_idx" ON "highlights"("paper_id");
    CREATE INDEX "highlights_user_id_idx" ON "highlights"("user_id");
    CREATE INDEX "highlights_paper_id_page_number_idx" ON "highlights"("paper_id", "page_number");

    -- ============================================================================
    -- TABLE: highlight_comments
    -- ============================================================================

    CREATE TABLE "highlight_comments"
    (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "highlight_id" UUID NOT NULL,
        "user_id" UUID NOT NULL,
        "content" TEXT NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL,

        CONSTRAINT "highlight_comments_pkey" PRIMARY KEY ("id")
    );

    CREATE INDEX "highlight_comments_highlight_id_idx" ON "highlight_comments"("highlight_id");
    CREATE INDEX "highlight_comments_user_id_idx" ON "highlight_comments"("user_id");

    -- ============================================================================
    -- FOREIGN KEY CONSTRAINTS
    -- ============================================================================

    -- refresh_tokens → users
    ALTER TABLE "refresh_tokens"
ADD CONSTRAINT "refresh_tokens_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

    -- folders → users
    ALTER TABLE "folders"
ADD CONSTRAINT "folders_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

    -- papers → users
    ALTER TABLE "papers"
ADD CONSTRAINT "papers_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

    -- papers → folders
    ALTER TABLE "papers"
ADD CONSTRAINT "papers_folder_id_fkey"
FOREIGN KEY ("folder_id") REFERENCES "folders"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

    -- conversations → users
    ALTER TABLE "conversations"
ADD CONSTRAINT "conversations_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

    -- conversations → papers (nullable for MULTI_PAPER)
    ALTER TABLE "conversations"
ADD CONSTRAINT "conversations_paper_id_fkey"
FOREIGN KEY ("paper_id") REFERENCES "papers"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

    -- messages → conversations
    ALTER TABLE "messages"
ADD CONSTRAINT "messages_conversation_id_fkey"
FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

    -- suggested_questions → conversations
    ALTER TABLE "suggested_questions"
ADD CONSTRAINT "suggested_questions_conversation_id_fkey"
FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

    -- related_papers → papers
    ALTER TABLE "related_papers"
ADD CONSTRAINT "related_papers_paper_id_fkey"
FOREIGN KEY ("paper_id") REFERENCES "papers"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

    -- highlights → papers
    ALTER TABLE "highlights"
ADD CONSTRAINT "highlights_paper_id_fkey"
FOREIGN KEY ("paper_id") REFERENCES "papers"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

    -- highlights → users
    ALTER TABLE "highlights"
ADD CONSTRAINT "highlights_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

    -- highlight_comments → highlights
    ALTER TABLE "highlight_comments"
ADD CONSTRAINT "highlight_comments_highlight_id_fkey"
FOREIGN KEY ("highlight_id") REFERENCES "highlights"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

    -- highlight_comments → users
    ALTER TABLE "highlight_comments"
ADD CONSTRAINT "highlight_comments_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
