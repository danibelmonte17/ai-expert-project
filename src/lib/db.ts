import { PrismaClient } from "@prisma/client";

/**
 * Singleton de PrismaClient (capa de acceso a datos, `catalog-list`).
 *
 * En desarrollo, Next.js recarga los modulos con HMR; guardar la instancia en
 * `globalThis` evita crear un cliente nuevo (y agotar conexiones) en cada
 * recarga. En produccion se crea una instancia por proceso.
 *
 * La URL de la base se resuelve siempre via `DATABASE_URL` (nunca se asume el
 * nombre del fichero SQLite): Prisma lo lee de `.env`/entorno.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
