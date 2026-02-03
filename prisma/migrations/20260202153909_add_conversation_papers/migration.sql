-- CreateTable
CREATE TABLE "conversation_papers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "paper_id" UUID NOT NULL,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_papers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversation_papers_conversation_id_idx" ON "conversation_papers"("conversation_id");

-- CreateIndex
CREATE INDEX "conversation_papers_paper_id_idx" ON "conversation_papers"("paper_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_papers_conversation_id_paper_id_key" ON "conversation_papers"("conversation_id", "paper_id");

-- AddForeignKey
ALTER TABLE "conversation_papers" ADD CONSTRAINT "conversation_papers_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_papers" ADD CONSTRAINT "conversation_papers_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
