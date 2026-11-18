import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";

// Single PrismaClient per process; reused across hot reloads in dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient | { $disconnect(): Promise<void> } };

function createClient() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    connectionLimit: 5,
    // MySQL 8 uses caching_sha2_password; needed for local connections without TLS.
    allowPublicKeyRetrieval: true,
  });
  return new PrismaClient({ adapter });
}

// After `prisma generate` the dev server reloads the generated module, so a cached client built
// from the previous class no longer matches the schema: drop it and build a new one.
const cached = globalForPrisma.prisma;
if (cached && !(cached instanceof PrismaClient)) void cached.$disconnect().catch(() => {});

export const prisma = cached instanceof PrismaClient ? cached : createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
