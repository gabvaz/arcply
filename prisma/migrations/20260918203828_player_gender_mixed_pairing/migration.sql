/*
  Warnings:

  - Added the required column `gender` to the `Player` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Play" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "gamesToWin" INTEGER NOT NULL DEFAULT 0,
    "format" TEXT NOT NULL,
    "rounds" INTEGER NOT NULL DEFAULT 1,
    "pairingMode" TEXT NOT NULL,
    "mixedPairing" TEXT NOT NULL DEFAULT 'IGNORE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Play" ("createdAt", "format", "gamesToWin", "id", "name", "pairingMode", "rounds", "status", "updatedAt") SELECT "createdAt", "format", "gamesToWin", "id", "name", "pairingMode", "rounds", "status", "updatedAt" FROM "Play";
DROP TABLE "Play";
ALTER TABLE "new_Play" RENAME TO "Play";
CREATE TABLE "new_Player" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "contact" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Player" ("contact", "createdAt", "gender", "id", "name", "updatedAt") SELECT "contact", "createdAt", 'MALE', "id", "name", "updatedAt" FROM "Player";
DROP TABLE "Player";
ALTER TABLE "new_Player" RENAME TO "Player";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
