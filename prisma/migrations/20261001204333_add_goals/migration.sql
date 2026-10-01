-- CreateTable
CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "metaMatricula" INTEGER NOT NULL DEFAULT 0,
    "metaFaturamento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "metaFollowup" INTEGER NOT NULL DEFAULT 0,
    "metaIndicacao" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "goals_month_year_idx" ON "goals"("month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "goals_userId_month_year_key" ON "goals"("userId", "month", "year");

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
