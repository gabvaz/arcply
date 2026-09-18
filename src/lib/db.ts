import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  // Produção (Netlify/Vercel): Turso via driver adapter
  if (tursoUrl && tursoToken) {
    const adapter = new PrismaLibSQL({
      url: tursoUrl,
      authToken: tursoToken,
    });
    return new PrismaClient({ adapter });
  }

  // Local: SQLite file via DATABASE_URL (ver .env.example)
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
