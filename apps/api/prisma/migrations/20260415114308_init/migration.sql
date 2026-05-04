-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'COOPERATIVE', 'PRODUCER');

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('BASIC', 'PRO', 'COOPERATIVE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "EntryType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "EntryCategory" AS ENUM ('DEFENSIVE', 'FERTILIZER', 'SEED', 'FUEL', 'MACHINERY_MAINTENANCE', 'LABOR', 'LEASE', 'FREIGHT_DRYING', 'PRODUCTION_SALE', 'OTHER_INCOME', 'OTHER_EXPENSE');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('INVOICE_PHOTO', 'INVOICE_XML', 'GENERATED_PDF', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING_OCR', 'OCR_DONE', 'ERROR');

-- CreateEnum
CREATE TYPE "HarvestStatus" AS ENUM ('PLANNING', 'ACTIVE', 'HARVESTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('COST_ABOVE_TARGET', 'LOW_BALANCE', 'INSTALLMENT_DUE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "WhatsappProvider" AS ENUM ('EVOLUTION', 'OFFICIAL');

-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('OPENAI', 'ANTHROPIC');

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PlanType" NOT NULL,
    "priceMonthly" DOUBLE PRECISION NOT NULL,
    "maxProperties" INTEGER NOT NULL DEFAULT 1,
    "maxUsers" INTEGER NOT NULL DEFAULT 1,
    "hasOcr" BOOLEAN NOT NULL DEFAULT false,
    "hasAiAgent" BOOLEAN NOT NULL DEFAULT false,
    "hasAutoDre" BOOLEAN NOT NULL DEFAULT false,
    "hasAlerts" BOOLEAN NOT NULL DEFAULT false,
    "hasWhitelabel" BOOLEAN NOT NULL DEFAULT false,
    "hasPrioritySupport" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "stripePriceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'PRODUCER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cooperatives" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cnpj" TEXT,
    "subdomain" TEXT NOT NULL,
    "logoUrl" TEXT,
    "primaryColor" TEXT DEFAULT '#16a34a',
    "planId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cooperatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cpfCnpj" TEXT,
    "whatsapp" TEXT NOT NULL,
    "cooperativeId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "producers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "producerId" TEXT,
    "cooperativeId" TEXT,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL,
    "producerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hectares" DOUBLE PRECISION,
    "state" TEXT,
    "city" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "harvests" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "crop" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "targetCostPerHa" DOUBLE PRECISION,
    "status" "HarvestStatus" NOT NULL DEFAULT 'PLANNING',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "harvests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plots" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hectares" DOUBLE PRECISION,
    "currentCrop" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entries" (
    "id" TEXT NOT NULL,
    "harvestId" TEXT NOT NULL,
    "plotId" TEXT,
    "documentId" TEXT,
    "type" "EntryType" NOT NULL,
    "category" "EntryCategory" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "supplier" TEXT,
    "supplierCnpj" TEXT,
    "description" TEXT,
    "status" "EntryStatus" NOT NULL DEFAULT 'CONFIRMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "producerId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "s3Key" TEXT NOT NULL,
    "s3Url" TEXT NOT NULL,
    "ocrText" TEXT,
    "ocrData" JSONB,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING_OCR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "producerId" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_sessions" (
    "id" TEXT NOT NULL,
    "producerId" TEXT NOT NULL,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_cache" (
    "id" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "name" TEXT,
    "category" "EntryCategory" NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "cooperatives_userId_key" ON "cooperatives"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "cooperatives_cnpj_key" ON "cooperatives"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "cooperatives_subdomain_key" ON "cooperatives"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "producers_userId_key" ON "producers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "producers_whatsapp_key" ON "producers"("whatsapp");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_cache_cnpj_key" ON "supplier_cache"("cnpj");

-- AddForeignKey
ALTER TABLE "cooperatives" ADD CONSTRAINT "cooperatives_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cooperatives" ADD CONSTRAINT "cooperatives_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producers" ADD CONSTRAINT "producers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producers" ADD CONSTRAINT "producers_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "cooperatives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "producers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "cooperatives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "producers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "harvests" ADD CONSTRAINT "harvests_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plots" ADD CONSTRAINT "plots_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entries" ADD CONSTRAINT "entries_harvestId_fkey" FOREIGN KEY ("harvestId") REFERENCES "harvests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entries" ADD CONSTRAINT "entries_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "plots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entries" ADD CONSTRAINT "entries_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "producers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "producers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "producers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
