/*
  Warnings:

  - You are about to drop the column `color` on the `folders` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `folders` table. All the data in the column will be lost.
  - You are about to drop the column `icon` on the `folders` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "folders" DROP COLUMN "color",
DROP COLUMN "description",
DROP COLUMN "icon";
