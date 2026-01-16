-- CreateTable
CREATE TABLE "RecentTopic" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecentTopic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecentTopic_userId_createdAt_idx" ON "RecentTopic"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "RecentTopic" ADD CONSTRAINT "RecentTopic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
