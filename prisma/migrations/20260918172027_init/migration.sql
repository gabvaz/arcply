-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Play" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "gamesToWin" INTEGER NOT NULL,
    "format" TEXT NOT NULL,
    "rounds" INTEGER NOT NULL DEFAULT 1,
    "pairingMode" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PlayEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    CONSTRAINT "PlayEntry_playId_fkey" FOREIGN KEY ("playId") REFERENCES "Play" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayEntry_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Pair" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playId" TEXT NOT NULL,
    "playerAId" TEXT NOT NULL,
    "playerBId" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Pair_playId_fkey" FOREIGN KEY ("playId") REFERENCES "Play" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Pair_playerAId_fkey" FOREIGN KEY ("playerAId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Pair_playerBId_fkey" FOREIGN KEY ("playerBId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playId" TEXT NOT NULL,
    "pairHomeId" TEXT NOT NULL,
    "pairAwayId" TEXT NOT NULL,
    "gamesHome" INTEGER,
    "gamesAway" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "scoreOverride" BOOLEAN NOT NULL DEFAULT false,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Match_playId_fkey" FOREIGN KEY ("playId") REFERENCES "Play" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Match_pairHomeId_fkey" FOREIGN KEY ("pairHomeId") REFERENCES "Pair" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Match_pairAwayId_fkey" FOREIGN KEY ("pairAwayId") REFERENCES "Pair" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PlayEntry_playId_playerId_key" ON "PlayEntry"("playId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "Pair_playId_playerAId_key" ON "Pair"("playId", "playerAId");

-- CreateIndex
CREATE UNIQUE INDEX "Pair_playId_playerBId_key" ON "Pair"("playId", "playerBId");
