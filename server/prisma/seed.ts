import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Domínios já plugados no frontend (ver src/dojo/registry.ts). */
const DOMAINS = [
  { slug: "git", name: "Git" },
  { slug: "wp-cli", name: "WP-CLI" },
];

async function main() {
  for (const domain of DOMAINS) {
    await prisma.domain.upsert({
      where: { slug: domain.slug },
      update: { name: domain.name },
      create: domain,
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
