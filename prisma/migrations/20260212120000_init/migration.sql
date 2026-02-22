-- ============================================================================
-- RAG SCIENTIFIC - CONSOLIDATED INITIAL MIGRATION
-- Generated: 2026-02-15
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
('SINGLE_PAPER', 'MULTI_PAPER', 'GROUP');
CREATE TYPE "MessageRole" AS ENUM
('USER', 'ASSISTANT', 'SYSTEM');
CREATE TYPE "HighlightColor" AS ENUM
('YELLOW', 'GREEN', 'BLUE', 'PINK', 'ORANGE');
CREATE TYPE "SessionRole" AS ENUM
('OWNER', 'MEMBER');

-- ============================================================================
-- RAG SERVICE TABLES
-- ============================================================================

-- rag_paper_cache: RAG processing cache
CREATE TABLE "rag_paper_cache"
(
    "rag_paper_id" VARCHAR(100) NOT NULL,
    "file_content_hash" VARCHAR(64),
    "last_processed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rag_paper_cache_pkey" PRIMARY KEY ("rag_paper_id")
);

-- paper_content_summaries: Cache LLM-generated summaries for tables and images
CREATE TABLE "paper_content_summaries"
(
    "id" SERIAL NOT NULL,
    "rag_paper_id" VARCHAR(100) NOT NULL,
    "content_type" VARCHAR(20) NOT NULL,
    "content_index" INTEGER NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "summary_text" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "paper_content_summaries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "paper_content_summaries_rag_paper_id_content_type_content_idx" ON "paper_content_summaries"("rag_paper_id", "content_type", "content_index");
CREATE INDEX "paper_content_summaries_rag_paper_id_idx" ON "paper_content_summaries"("rag_paper_id");
CREATE INDEX "paper_content_summaries_rag_paper_id_content_type_idx" ON "paper_content_summaries"("rag_paper_id", "content_type");

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
-- ============================================================================

CREATE TABLE "conversations"
(
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "paper_id" UUID,
    "title" VARCHAR(300),
    "type" "ConversationType" NOT NULL DEFAULT 'SINGLE_PAPER',
    "is_collaborative" BOOLEAN NOT NULL DEFAULT false,
    "session_code" VARCHAR(20),
    "max_members" INTEGER NOT NULL DEFAULT 10,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "conversations_user_id_idx" ON "conversations"("user_id");
CREATE INDEX "conversations_paper_id_idx" ON "conversations"("paper_id");
CREATE INDEX "conversations_created_at_idx" ON "conversations"("created_at");
CREATE INDEX "conversations_type_idx" ON "conversations"("type");
CREATE UNIQUE INDEX "conversations_session_code_key" ON "conversations"("session_code") WHERE "session_code" IS NOT NULL;
CREATE INDEX "conversations_is_collaborative_idx" ON "conversations"("is_collaborative");

-- ============================================================================
-- TABLE: messages
-- ============================================================================

CREATE TABLE "messages"
(
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "user_id" UUID,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "image_url" VARCHAR(1000),
    "model_name" VARCHAR(100),
    "token_count" INTEGER,
    "context" JSONB DEFAULT '{}',
    "reply_to_message_id" UUID,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "messages_conversation_id_idx" ON "messages"("conversation_id");
CREATE INDEX "messages_created_at_idx" ON "messages"("created_at");
CREATE INDEX "messages_user_id_idx" ON "messages"("user_id");
CREATE INDEX "messages_reply_to_message_id_idx" ON "messages"("reply_to_message_id");

-- ============================================================================
-- TABLE: message_reactions
-- ============================================================================

CREATE TABLE "message_reactions"
(
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "message_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "emoji" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "message_reactions_message_id_user_id_key" ON "message_reactions"("message_id", "user_id");
CREATE INDEX "message_reactions_message_id_idx" ON "message_reactions"("message_id");

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
    -- TABLE: session_members
    -- ============================================================================

    CREATE TABLE "session_members"
    (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "conversation_id" UUID NOT NULL,
        "user_id" UUID NOT NULL,
        "role" "SessionRole" NOT NULL DEFAULT 'MEMBER',
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "joined_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "left_at" TIMESTAMPTZ,
        CONSTRAINT "session_members_pkey" PRIMARY KEY ("id")
    );

    CREATE UNIQUE INDEX "session_members_conversation_id_user_id_key" ON "session_members"("conversation_id", "user_id");
    CREATE INDEX "session_members_conversation_id_idx" ON "session_members"("conversation_id");
    CREATE INDEX "session_members_user_id_idx" ON "session_members"("user_id");

    -- ============================================================================
    -- TABLE: session_invites
    -- ============================================================================

    CREATE TABLE "session_invites"
    (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "conversation_id" UUID NOT NULL,
        "invited_by" UUID NOT NULL,
        "invite_token" VARCHAR(100) NOT NULL,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "max_uses" INTEGER NOT NULL DEFAULT 0,
        "use_count" INTEGER NOT NULL DEFAULT 0,
        "is_revoked" BOOLEAN NOT NULL DEFAULT false,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "session_invites_pkey" PRIMARY KEY ("id")
    );

    CREATE UNIQUE INDEX "session_invites_invite_token_key" ON "session_invites"("invite_token");
    CREATE INDEX "session_invites_conversation_id_idx" ON "session_invites"("conversation_id");
    CREATE INDEX "session_invites_invite_token_idx" ON "session_invites"("invite_token");
    CREATE INDEX "session_invites_expires_at_idx" ON "session_invites"("expires_at");

    -- ============================================================================
    -- FOREIGN KEY CONSTRAINTS
    -- ============================================================================

    ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

    -- folders → users
    ALTER TABLE "folders" ADD CONSTRAINT "folders_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE "papers" ADD CONSTRAINT "papers_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

    -- papers → folders
    ALTER TABLE "papers" ADD CONSTRAINT "papers_folder_id_fkey"
    FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

    ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE "conversations" ADD CONSTRAINT "conversations_paper_id_fkey"
    FOREIGN KEY ("paper_id") REFERENCES "papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

    ALTER TABLE "messages" ADD CONSTRAINT "messages_reply_to_message_id_fkey"
    FOREIGN KEY ("reply_to_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

    ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_message_id_fkey"
    FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE "suggested_questions" ADD CONSTRAINT "suggested_questions_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE "related_papers" ADD CONSTRAINT "related_papers_paper_id_fkey"
    FOREIGN KEY ("paper_id") REFERENCES "papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE "highlights" ADD CONSTRAINT "highlights_paper_id_fkey"
    FOREIGN KEY ("paper_id") REFERENCES "papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE "highlights" ADD CONSTRAINT "highlights_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE "highlight_comments" ADD CONSTRAINT "highlight_comments_highlight_id_fkey"
    FOREIGN KEY ("highlight_id") REFERENCES "highlights"("id") ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE "highlight_comments" ADD CONSTRAINT "highlight_comments_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE "session_members" ADD CONSTRAINT "session_members_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE "session_members" ADD CONSTRAINT "session_members_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE "session_invites" ADD CONSTRAINT "session_invites_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE "session_invites" ADD CONSTRAINT "session_invites_invited_by_fkey"
    FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
