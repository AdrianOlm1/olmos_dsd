-- AlterTable
ALTER TABLE "auto_dispatch_settings" ADD COLUMN     "preselectByDefault" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "dispatch_selection_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "batchId" TEXT,
    "urgencyScore" INTEGER NOT NULL,
    "selected" BOOLEAN NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "zone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispatch_selection_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_customer_affinity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "pickCount" INTEGER NOT NULL DEFAULT 0,
    "skipCount" INTEGER NOT NULL DEFAULT 0,
    "lastPickedAt" TIMESTAMP(3),
    "affinityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_customer_affinity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dispatch_selection_events_userId_customerId_idx" ON "dispatch_selection_events"("userId", "customerId");

-- CreateIndex
CREATE INDEX "dispatch_selection_events_userId_dayOfWeek_idx" ON "dispatch_selection_events"("userId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "dispatch_selection_events_createdAt_idx" ON "dispatch_selection_events"("createdAt");

-- CreateIndex
CREATE INDEX "user_customer_affinity_userId_affinityScore_idx" ON "user_customer_affinity"("userId", "affinityScore");

-- CreateIndex
CREATE UNIQUE INDEX "user_customer_affinity_userId_customerId_key" ON "user_customer_affinity"("userId", "customerId");
