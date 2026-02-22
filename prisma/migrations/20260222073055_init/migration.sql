-- CreateTable
CREATE TABLE "PriceCheck" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceName" TEXT,
    "title" TEXT,
    "currentPrice" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "rawInput" TEXT,
    "fairPriceLow" DOUBLE PRECISION,
    "fairPriceHigh" DOUBLE PRECISION,
    "surgeScore" DOUBLE PRECISION,
    "recommendation" TEXT,
    "confidenceScore" DOUBLE PRECISION,
    "insightSummary" TEXT,
    "fullAnalysis" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceCheck_pkey" PRIMARY KEY ("id")
);
