/*
  Warnings:

  - You are about to drop the `answer_citation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `app_user` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `chunk` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `chunk_element` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `conversation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `formula_insight` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `message` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `paper` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `paper_element` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `paper_page` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `paper_section` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `qa_turn` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `selection_region` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "answer_citation" DROP CONSTRAINT "answer_citation_chunk_id_fkey";

-- DropForeignKey
ALTER TABLE "answer_citation" DROP CONSTRAINT "answer_citation_element_id_fkey";

-- DropForeignKey
ALTER TABLE "answer_citation" DROP CONSTRAINT "answer_citation_qa_turn_id_fkey";

-- DropForeignKey
ALTER TABLE "chunk" DROP CONSTRAINT "chunk_paper_id_fkey";

-- DropForeignKey
ALTER TABLE "chunk" DROP CONSTRAINT "chunk_section_id_fkey";

-- DropForeignKey
ALTER TABLE "chunk_element" DROP CONSTRAINT "chunk_element_chunk_id_fkey";

-- DropForeignKey
ALTER TABLE "chunk_element" DROP CONSTRAINT "chunk_element_element_id_fkey";

-- DropForeignKey
ALTER TABLE "conversation" DROP CONSTRAINT "conversation_paper_id_fkey";

-- DropForeignKey
ALTER TABLE "conversation" DROP CONSTRAINT "conversation_user_id_fkey";

-- DropForeignKey
ALTER TABLE "formula_insight" DROP CONSTRAINT "formula_insight_qa_turn_id_fkey";

-- DropForeignKey
ALTER TABLE "formula_insight" DROP CONSTRAINT "formula_insight_selection_region_id_fkey";

-- DropForeignKey
ALTER TABLE "message" DROP CONSTRAINT "message_conversation_id_fkey";

-- DropForeignKey
ALTER TABLE "paper" DROP CONSTRAINT "paper_owner_user_id_fkey";

-- DropForeignKey
ALTER TABLE "paper_element" DROP CONSTRAINT "paper_element_page_id_fkey";

-- DropForeignKey
ALTER TABLE "paper_element" DROP CONSTRAINT "paper_element_paper_id_fkey";

-- DropForeignKey
ALTER TABLE "paper_element" DROP CONSTRAINT "paper_element_section_id_fkey";

-- DropForeignKey
ALTER TABLE "paper_page" DROP CONSTRAINT "paper_page_paper_id_fkey";

-- DropForeignKey
ALTER TABLE "paper_section" DROP CONSTRAINT "paper_section_paper_id_fkey";

-- DropForeignKey
ALTER TABLE "qa_turn" DROP CONSTRAINT "qa_turn_assistant_message_id_fkey";

-- DropForeignKey
ALTER TABLE "qa_turn" DROP CONSTRAINT "qa_turn_conversation_id_fkey";

-- DropForeignKey
ALTER TABLE "qa_turn" DROP CONSTRAINT "qa_turn_user_message_id_fkey";

-- DropForeignKey
ALTER TABLE "selection_region" DROP CONSTRAINT "selection_region_created_by_user_fkey";

-- DropForeignKey
ALTER TABLE "selection_region" DROP CONSTRAINT "selection_region_element_id_fkey";

-- DropForeignKey
ALTER TABLE "selection_region" DROP CONSTRAINT "selection_region_page_id_fkey";

-- DropForeignKey
ALTER TABLE "selection_region" DROP CONSTRAINT "selection_region_paper_id_fkey";

-- DropTable
DROP TABLE "answer_citation";

-- DropTable
DROP TABLE "app_user";

-- DropTable
DROP TABLE "chunk";

-- DropTable
DROP TABLE "chunk_element";

-- DropTable
DROP TABLE "conversation";

-- DropTable
DROP TABLE "formula_insight";

-- DropTable
DROP TABLE "message";

-- DropTable
DROP TABLE "paper";

-- DropTable
DROP TABLE "paper_element";

-- DropTable
DROP TABLE "paper_page";

-- DropTable
DROP TABLE "paper_section";

-- DropTable
DROP TABLE "qa_turn";

-- DropTable
DROP TABLE "selection_region";
