-- CreateTable
CREATE TABLE "CustomerInvite" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "customerId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerInvite_token_key" ON "CustomerInvite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerInvite_customerId_key" ON "CustomerInvite"("customerId");

-- CreateIndex
CREATE INDEX "CustomerInvite_token_idx" ON "CustomerInvite"("token");

-- AddForeignKey
ALTER TABLE "CustomerInvite" ADD CONSTRAINT "CustomerInvite_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvite" ADD CONSTRAINT "CustomerInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
