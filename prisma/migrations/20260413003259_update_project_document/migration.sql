/*
  Warnings:

  - Added the required column `updatedAt` to the `ProjectDocument` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DocumentProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED', 'UNSUPPORTED');

-- DropForeignKey
ALTER TABLE "ProjectDocument" DROP CONSTRAINT "ProjectDocument_projectId_fkey";

-- AlterTable
ALTER TABLE "ProjectDocument" ADD COLUMN     "pageCount" INTEGER,
ADD COLUMN     "processingError" TEXT,
ADD COLUMN     "processingStatus" "DocumentProcessingStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "summary" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "ProjectDocumentChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "pageNumberStart" INTEGER,
    "pageNumberEnd" INTEGER,
    "text" TEXT NOT NULL,
    "charCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectDocumentChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectDocumentChunk_documentId_pageNumberStart_pageNumberE_idx" ON "ProjectDocumentChunk"("documentId", "pageNumberStart", "pageNumberEnd");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectDocumentChunk_documentId_chunkIndex_key" ON "ProjectDocumentChunk"("documentId", "chunkIndex");

-- CreateIndex
CREATE INDEX "ProjectDocument_projectId_createdAt_idx" ON "ProjectDocument"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectDocument_projectId_fileName_idx" ON "ProjectDocument"("projectId", "fileName");

-- AddForeignKey
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDocumentChunk" ADD CONSTRAINT "ProjectDocumentChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ProjectDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
