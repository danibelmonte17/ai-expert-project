import { PrismaClient } from "@prisma/client";

/**
 * Cliente Prisma singleton (catalog-list).
 *
 * Unica puerta a Prisma desde `src/`: ninguna otra capa debe instanciar
 * `new PrismaClient()`. El cliente se guarda en `globalThis` para sobrevivir al
 * HMR de `next dev` y no agotar el pool de conexiones con cada recarga.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
