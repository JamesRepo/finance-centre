import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
  prismaPool?: pg.Pool;
};

function createAdapter(pool: pg.Pool) {
  return new PrismaPg(
    pool as unknown as ConstructorParameters<typeof PrismaPg>[0],
  );
}

export const prisma =
  globalForPrisma.prisma ??
  (() => {
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
    });

    const adapter = createAdapter(pool);

    const client = new PrismaClient({ adapter });

    globalForPrisma.prismaPool = pool;

    return client;
  })();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
