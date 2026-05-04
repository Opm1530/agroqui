-- CreateTable
CREATE TABLE "price_index" (
    "id" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "category" "EntryCategory" NOT NULL,
    "city" TEXT,
    "state" TEXT NOT NULL,
    "pricePerUnit" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "quantity" DOUBLE PRECISION,
    "totalAmount" DOUBLE PRECISION,
    "supplier" TEXT,
    "supplierCnpj" TEXT,
    "documentId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_index_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "price_index_category_state_date_idx" ON "price_index"("category", "state", "date");

-- CreateIndex
CREATE INDEX "price_index_product_state_date_idx" ON "price_index"("product", "state", "date");

-- CreateIndex
CREATE INDEX "price_index_product_city_date_idx" ON "price_index"("product", "city", "date");
