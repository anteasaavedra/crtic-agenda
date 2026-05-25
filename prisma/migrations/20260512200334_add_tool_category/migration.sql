-- CreateEnum
CREATE TYPE "ToolCategory" AS ENUM ('LICENCIA', 'MENTORIA');

-- AlterTable
ALTER TABLE "Tool" ADD COLUMN     "category" "ToolCategory" NOT NULL DEFAULT 'LICENCIA';

-- CreateIndex
CREATE INDEX "Tool_category_isActive_idx" ON "Tool"("category", "isActive");
