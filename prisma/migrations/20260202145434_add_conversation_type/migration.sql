-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('SINGLE_PAPER', 'MULTI_PAPER');

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "type" "ConversationType" NOT NULL DEFAULT 'SINGLE_PAPER';

-- CreateIndex
CREATE INDEX "conversations_type_idx" ON "conversations"("type");
