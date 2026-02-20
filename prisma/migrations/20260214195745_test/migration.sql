-- CreateTable
CREATE TABLE "answer_citation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "qa_turn_id" UUID,
    "chunk_id" UUID,
    "element_id" UUID,
    "page_number" INTEGER,
    "source_snippet" TEXT,
    "answer_span_start" INTEGER,
    "answer_span_end" INTEGER,
    "relevance_score" DOUBLE PRECISION,
    "is_primary" BOOLEAN,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "answer_citation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_user" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT,
    "role" TEXT DEFAULT 'user',
    "avatar_url" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "last_login_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chunk" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "paper_id" UUID,
    "section_id" UUID,
    "page_start" INTEGER,
    "page_end" INTEGER,
    "content" TEXT,
    "token_count" INTEGER,
    "chunk_index" INTEGER,
    "embedding" TEXT,
    "external_vec_id" TEXT,
    "splitter_name" TEXT,
    "splitter_params" JSONB,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chunk_element" (
    "chunk_id" UUID NOT NULL,
    "element_id" UUID NOT NULL,
    "position" INTEGER,

    CONSTRAINT "chunk_element_pkey" PRIMARY KEY ("chunk_id","element_id")
);

-- CreateTable
CREATE TABLE "conversation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "paper_id" UUID,
    "title" TEXT,
    "mode" TEXT DEFAULT 'novice',
    "description" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formula_insight" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "selection_region_id" UUID,
    "qa_turn_id" UUID,
    "audience_level" TEXT,
    "variables_json" JSONB,
    "conceptual_explanation" TEXT,
    "pipeline_role" TEXT,
    "assumptions" TEXT,
    "limitations" TEXT,
    "model_name" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "formula_insight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID,
    "role" TEXT,
    "content" TEXT,
    "token_count" INTEGER,
    "model_name" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paper" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_user_id" UUID,
    "title" TEXT,
    "abstract" TEXT,
    "authors" TEXT,
    "publication_year" INTEGER,
    "venue" TEXT,
    "source" TEXT,
    "doi" TEXT,
    "arxiv_id" TEXT,
    "url" TEXT,
    "num_pages" INTEGER,
    "status" TEXT DEFAULT 'processing',
    "domain_tag" TEXT,
    "language" TEXT,
    "file_path" TEXT,
    "meta_json" JSONB,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paper_element" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "paper_id" UUID,
    "page_id" UUID,
    "section_id" UUID,
    "element_type" TEXT,
    "label" TEXT,
    "order_in_page" INTEGER,
    "bbox_x" DOUBLE PRECISION,
    "bbox_y" DOUBLE PRECISION,
    "bbox_width" DOUBLE PRECISION,
    "bbox_height" DOUBLE PRECISION,
    "raw_text" TEXT,
    "normalized_text" TEXT,
    "confidence" DOUBLE PRECISION,
    "extra_json" JSONB,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paper_element_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paper_page" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "paper_id" UUID,
    "page_number" INTEGER NOT NULL,
    "text" TEXT,
    "image_path" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "meta_json" JSONB,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paper_page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paper_section" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "paper_id" UUID,
    "section_type" TEXT,
    "heading" TEXT,
    "level" INTEGER,
    "order_index" INTEGER,
    "start_page" INTEGER,
    "end_page" INTEGER,
    "content" TEXT,
    "meta_json" JSONB,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paper_section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qa_turn" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID,
    "user_message_id" UUID,
    "assistant_message_id" UUID,
    "mode_snapshot" TEXT,
    "retriever_config_json" JSONB,
    "generator_config_json" JSONB,
    "system_prompt_snapshot" TEXT,
    "latency_ms" INTEGER,
    "token_input" INTEGER,
    "token_output" INTEGER,
    "cost_usd" DECIMAL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qa_turn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "selection_region" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "paper_id" UUID,
    "page_id" UUID,
    "element_id" UUID,
    "selection_type" TEXT DEFAULT 'auto',
    "bbox_x" DOUBLE PRECISION,
    "bbox_y" DOUBLE PRECISION,
    "bbox_width" DOUBLE PRECISION,
    "bbox_height" DOUBLE PRECISION,
    "image_path" TEXT,
    "extracted_text" TEXT,
    "latex" TEXT,
    "created_by_user" UUID,
    "created_source" TEXT,
    "meta_json" JSONB,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "selection_region_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS rag_paper_cache (
    rag_paper_id VARCHAR(100) PRIMARY KEY,
    file_content_hash VARCHAR(64),
    last_processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS paper_content_summaries (
    id SERIAL PRIMARY KEY,
    rag_paper_id VARCHAR(100) NOT NULL,
    content_type VARCHAR(20) NOT NULL,
    content_index INTEGER NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    summary_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT paper_content_summaries_unique
        UNIQUE (rag_paper_id, content_type, content_index),

    CONSTRAINT paper_content_summaries_content_type_check
        CHECK (content_type IN ('table', 'image'))
);


CREATE INDEX IF NOT EXISTS idx_summaries_paper
    ON paper_content_summaries (rag_paper_id);

CREATE INDEX IF NOT EXISTS idx_summaries_type
    ON paper_content_summaries (rag_paper_id, content_type);

-- CreateIndex
CREATE UNIQUE INDEX "app_user_email_key" ON "app_user"("email");

-- AddForeignKey
ALTER TABLE "answer_citation" ADD CONSTRAINT "answer_citation_chunk_id_fkey" FOREIGN KEY ("chunk_id") REFERENCES "chunk"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "answer_citation" ADD CONSTRAINT "answer_citation_element_id_fkey" FOREIGN KEY ("element_id") REFERENCES "paper_element"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "answer_citation" ADD CONSTRAINT "answer_citation_qa_turn_id_fkey" FOREIGN KEY ("qa_turn_id") REFERENCES "qa_turn"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "chunk" ADD CONSTRAINT "chunk_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "paper"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "chunk" ADD CONSTRAINT "chunk_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "paper_section"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "chunk_element" ADD CONSTRAINT "chunk_element_chunk_id_fkey" FOREIGN KEY ("chunk_id") REFERENCES "chunk"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "chunk_element" ADD CONSTRAINT "chunk_element_element_id_fkey" FOREIGN KEY ("element_id") REFERENCES "paper_element"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "paper"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "formula_insight" ADD CONSTRAINT "formula_insight_qa_turn_id_fkey" FOREIGN KEY ("qa_turn_id") REFERENCES "qa_turn"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "formula_insight" ADD CONSTRAINT "formula_insight_selection_region_id_fkey" FOREIGN KEY ("selection_region_id") REFERENCES "selection_region"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversation"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "paper" ADD CONSTRAINT "paper_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "app_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "paper_element" ADD CONSTRAINT "paper_element_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "paper_page"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "paper_element" ADD CONSTRAINT "paper_element_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "paper"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "paper_element" ADD CONSTRAINT "paper_element_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "paper_section"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "paper_page" ADD CONSTRAINT "paper_page_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "paper"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "paper_section" ADD CONSTRAINT "paper_section_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "paper"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "qa_turn" ADD CONSTRAINT "qa_turn_assistant_message_id_fkey" FOREIGN KEY ("assistant_message_id") REFERENCES "message"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "qa_turn" ADD CONSTRAINT "qa_turn_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversation"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "qa_turn" ADD CONSTRAINT "qa_turn_user_message_id_fkey" FOREIGN KEY ("user_message_id") REFERENCES "message"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "selection_region" ADD CONSTRAINT "selection_region_created_by_user_fkey" FOREIGN KEY ("created_by_user") REFERENCES "app_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "selection_region" ADD CONSTRAINT "selection_region_element_id_fkey" FOREIGN KEY ("element_id") REFERENCES "paper_element"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "selection_region" ADD CONSTRAINT "selection_region_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "paper_page"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "selection_region" ADD CONSTRAINT "selection_region_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "paper"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
