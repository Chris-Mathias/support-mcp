/*
  Warnings:

  - A unique constraint covering the columns `[projectId]` on the table `GitlabIntegration` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `projectPath` to the `GitlabIntegration` table without a default value. This is not possible if the table is not empty.
  - Added the required column `token` to the `GitlabIntegration` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "GitlabIntegration" ADD COLUMN     "projectPath" TEXT NOT NULL,
ADD COLUMN     "token" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "GitlabIntegration_projectId_key" ON "GitlabIntegration"("projectId");
