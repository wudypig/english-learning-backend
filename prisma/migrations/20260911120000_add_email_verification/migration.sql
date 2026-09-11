-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verificationToken" TEXT,
ADD COLUMN     "verificationTokenExpiry" TIMESTAMP(3);

-- Backfill: mark all existing users as verified so they are not locked out
UPDATE "User" SET "emailVerified" = true;

-- CreateIndex
CREATE UNIQUE INDEX "User_verificationToken_key" ON "User"("verificationToken");
