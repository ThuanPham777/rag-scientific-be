/*
  Warnings:

  - A unique constraint covering the columns `[session_code]` on the table `conversations` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'SUPERADMIN');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER';

-- CreateIndex
CREATE UNIQUE INDEX "conversations_session_code_key" ON "conversations"("session_code");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "users"("is_active");

-- RenameIndex
ALTER INDEX "paper_content_summaries_rag_paper_id_content_type_content_idx" RENAME TO "paper_content_summaries_rag_paper_id_content_type_content_i_key";
