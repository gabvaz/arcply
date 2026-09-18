-- DropIndex
DROP INDEX "Pair_playId_playerBId_key";

-- DropIndex
DROP INDEX "Pair_playId_playerAId_key";

-- AlterTable
ALTER TABLE "Pair" ADD COLUMN "withdrawnAt" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playId" TEXT NOT NULL,
    "pairHomeId" TEXT NOT NULL,
    "pairAwayId" TEXT NOT NULL,
    "gamesHome" INTEGER,
    "gamesAway" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "scoreOverride" BOOLEAN NOT NULL DEFAULT false,
    "round" INTEGER NOT NULL DEFAULT 1,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Match_playId_fkey" FOREIGN KEY ("playId") REFERENCES "Play" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Match_pairHomeId_fkey" FOREIGN KEY ("pairHomeId") REFERENCES "Pair" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Match_pairAwayId_fkey" FOREIGN KEY ("pairAwayId") REFERENCES "Pair" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Match" ("createdAt", "gamesAway", "gamesHome", "id", "orderIndex", "pairAwayId", "pairHomeId", "playId", "scoreOverride", "status", "updatedAt") SELECT "createdAt", "gamesAway", "gamesHome", "id", "orderIndex", "pairAwayId", "pairHomeId", "playId", "scoreOverride", "status", "updatedAt" FROM "Match";
DROP TABLE "Match";
ALTER TABLE "new_Match" RENAME TO "Match";
CREATE INDEX "Match_playId_round_idx" ON "Match"("playId", "round");
CREATE TABLE "new_Play" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "gamesToWin" INTEGER NOT NULL DEFAULT 0,
    "format" TEXT NOT NULL,
    "rounds" INTEGER NOT NULL DEFAULT 1,
    "pairingMode" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Play" ("createdAt", "format", "gamesToWin", "id", "name", "pairingMode", "rounds", "status", "updatedAt") SELECT "createdAt", "format", "gamesToWin", "id", "name", "pairingMode", "rounds", "status", "updatedAt" FROM "Play";
DROP TABLE "Play";
ALTER TABLE "new_Play" RENAME TO "Play";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Pair_playId_withdrawnAt_idx" ON "Pair"("playId", "withdrawnAt");
