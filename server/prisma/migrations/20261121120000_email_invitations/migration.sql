-- CreateEnum
CREATE TYPE "EmailInviteKind" AS ENUM ('FRIEND', 'GAME');

-- CreateEnum
CREATE TYPE "EmailInviteStatus" AS ENUM ('PENDING', 'REGISTERED', 'ALREADY_MEMBER', 'CLOSED', 'BLOCKED', 'EXPIRED');

-- AlterTable
ALTER TABLE "GameInvite" ADD COLUMN     "viaEmail" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "invitedById" TEXT;

-- CreateTable
CREATE TABLE "EmailInvite" (
    "id" TEXT NOT NULL,
    "kind" "EmailInviteKind" NOT NULL,
    "fromUserId" TEXT,
    "fromUsername" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "sessionId" TEXT,
    "initialMiles" INTEGER NOT NULL DEFAULT 0,
    "tokenHash" TEXT NOT NULL,
    "status" "EmailInviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "registeredUserId" TEXT,
    "registeredAt" TIMESTAMP(3),

    CONSTRAINT "EmailInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailOptOut" (
    "emailHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailOptOut_pkey" PRIMARY KEY ("emailHash")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailInvite_tokenHash_key" ON "EmailInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailInvite_fromUserId_createdAt_idx" ON "EmailInvite"("fromUserId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailInvite_email_createdAt_idx" ON "EmailInvite"("email", "createdAt");

-- CreateIndex
CREATE INDEX "EmailInvite_status_idx" ON "EmailInvite"("status");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailInvite" ADD CONSTRAINT "EmailInvite_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailInvite" ADD CONSTRAINT "EmailInvite_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailInvite" ADD CONSTRAINT "EmailInvite_registeredUserId_fkey" FOREIGN KEY ("registeredUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

