-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('LOCAL', 'GOOGLE');

-- CreateEnum
CREATE TYPE "PaperStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255),
    "provider" "AuthProvider" NOT NULL DEFAULT 'LOCAL',
    "provider_id" VARCHAR(255),
    "display_name" VARCHAR(100),
    "avatar_url" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
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

-- CreateTable
CREATE TABLE "papers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_url" VARCHAR(1000) NOT NULL,
    "file_size" BIGINT,
    "file_hash" VARCHAR(64),
    "rag_file_id" VARCHAR(100) NOT NULL,
    "title" VARCHAR(500),
    "abstract" TEXT,
    "authors" TEXT,
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

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "paper_id" UUID NOT NULL,
    "title" VARCHAR(300),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
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

-- CreateTable
CREATE TABLE "suggested_questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "paper_id" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suggested_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "related_papers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "paper_id" UUID NOT NULL,
    "arxiv_id" VARCHAR(50) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "abstract" TEXT NOT NULL,
    "authors" VARCHAR(255)[],
    "categories" VARCHAR(50)[],
    "url" VARCHAR(500) NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "related_papers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_provider_provider_id_key" ON "users"("provider", "provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "papers_rag_file_id_key" ON "papers"("rag_file_id");

-- CreateIndex
CREATE INDEX "papers_user_id_idx" ON "papers"("user_id");

-- CreateIndex
CREATE INDEX "papers_rag_file_id_idx" ON "papers"("rag_file_id");

-- CreateIndex
CREATE INDEX "papers_status_idx" ON "papers"("status");

-- CreateIndex
CREATE INDEX "conversations_user_id_idx" ON "conversations"("user_id");

-- CreateIndex
CREATE INDEX "conversations_paper_id_idx" ON "conversations"("paper_id");

-- CreateIndex
CREATE INDEX "conversations_created_at_idx" ON "conversations"("created_at");

-- CreateIndex
CREATE INDEX "messages_conversation_id_idx" ON "messages"("conversation_id");

-- CreateIndex
CREATE INDEX "messages_created_at_idx" ON "messages"("created_at");

-- CreateIndex
CREATE INDEX "suggested_questions_paper_id_idx" ON "suggested_questions"("paper_id");

-- CreateIndex
CREATE INDEX "related_papers_paper_id_idx" ON "related_papers"("paper_id");

-- CreateIndex
CREATE UNIQUE INDEX "related_papers_paper_id_arxiv_id_key" ON "related_papers"("paper_id", "arxiv_id");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "papers" ADD CONSTRAINT "papers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggested_questions" ADD CONSTRAINT "suggested_questions_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "related_papers" ADD CONSTRAINT "related_papers_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
