-- DropForeignKey
ALTER TABLE "papers" DROP CONSTRAINT "papers_folder_id_fkey";

-- AddForeignKey
ALTER TABLE "papers" ADD CONSTRAINT "papers_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
