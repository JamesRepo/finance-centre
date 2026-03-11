import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const categories = [
  { name: "Groceries", colorCode: "#22c55e" },
  { name: "Eating Out", colorCode: "#f59e0b" },
  { name: "Transport", colorCode: "#3b82f6" },
  { name: "Fun / Exercise", colorCode: "#a855f7" },
  { name: "Shopping", colorCode: "#ec4899" },
  { name: "Personal Care", colorCode: "#14b8a6" },
  { name: "Pub / Going Out", colorCode: "#64748b" },
  { name: "Clothes", colorCode: "#f97316" },
  { name: "Personal Development / Tech", colorCode: "#6366f1" },
];

async function main() {
  for (const category of categories) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: {},
      create: {
        ...category,
        isSystem: true,
      },
    });
  }

  console.log(`Seeded ${categories.length} categories`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
