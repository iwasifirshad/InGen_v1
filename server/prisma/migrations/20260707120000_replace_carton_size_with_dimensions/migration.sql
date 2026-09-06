-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Item" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "articleNumber" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "imageUrl" TEXT,
    "productSize" TEXT,
    "material" TEXT,
    "length" REAL,
    "width" REAL,
    "height" REAL,
    "dimensionUnit" TEXT,
    "netWeight" REAL,
    "grossWeight" REAL,
    "cbm" REAL,
    "priceUSD" REAL NOT NULL,
    "priceUpdatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Item" ("id", "articleNumber", "productName", "imageUrl", "productSize", "material", "netWeight", "grossWeight", "cbm", "priceUSD", "priceUpdatedAt", "createdAt")
SELECT "id", "articleNumber", "productName", "imageUrl", "productSize", "material", "netWeight", "grossWeight", "cbm", "priceUSD", "priceUpdatedAt", "createdAt" FROM "Item";
DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
CREATE UNIQUE INDEX "Item_articleNumber_key" ON "Item"("articleNumber");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
