-- CreateEnum
CREATE TYPE "HighlightColor" AS ENUM ('YELLOW', 'GREEN', 'BLUE', 'PINK', 'ORANGE');

-- CreateTable
CREATE TABLE "highlights" (
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

-- CreateTable
CREATE TABLE "highlight_comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "highlight_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "highlight_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "highlights_paper_id_idx" ON "highlights"("paper_id");

-- CreateIndex
CREATE INDEX "highlights_user_id_idx" ON "highlights"("user_id");

-- CreateIndex
CREATE INDEX "highlights_paper_id_page_number_idx" ON "highlights"("paper_id", "page_number");

-- CreateIndex
CREATE INDEX "highlight_comments_highlight_id_idx" ON "highlight_comments"("highlight_id");

-- CreateIndex
CREATE INDEX "highlight_comments_user_id_idx" ON "highlight_comments"("user_id");

-- AddForeignKey
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "highlight_comments" ADD CONSTRAINT "highlight_comments_highlight_id_fkey" FOREIGN KEY ("highlight_id") REFERENCES "highlights"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "highlight_comments" ADD CONSTRAINT "highlight_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
