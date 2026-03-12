import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;

async function main() {
  const [rawEmail, password] = process.argv.slice(2);

  if (!rawEmail || !password) {
    console.error("Usage: npx tsx scripts/set-password.ts <email> <password>");
    process.exit(1);
  }

  const email = rawEmail.toLowerCase();

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(
    pool as unknown as ConstructorParameters<typeof PrismaPg>[0],
  );
  const prisma = new PrismaClient({ adapter });

  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);

    const existing = await prisma.settings.findFirst();

    if (existing) {
      await prisma.settings.update({
        where: { id: existing.id },
        data: { email, passwordHash: hash },
      });
    } else {
      await prisma.settings.create({
        data: { email, passwordHash: hash },
      });
    }

    // eslint-disable-next-line no-console
    console.log(`Credentials set for ${email}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
