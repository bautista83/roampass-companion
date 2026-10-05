-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- DropIndex
DROP INDEX "CardQuestion_category_isActive_idx";

-- AlterTable
ALTER TABLE "CardQuestion" ADD COLUMN     "difficulty" "Difficulty";

-- CreateIndex
CREATE INDEX "CardQuestion_category_difficulty_isActive_idx" ON "CardQuestion"("category", "difficulty", "isActive");

