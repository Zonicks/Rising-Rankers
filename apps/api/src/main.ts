import { buildApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./infrastructure/database/prisma";

async function main() {
  const app = await buildApp();

  try {
    await prisma.$connect();
    app.log.info("PostgreSQL connected");
  } catch (err) {
    app.log.warn(
      { err },
      "PostgreSQL not connected yet — /health still works; run migrations when DB is ready"
    );
  }

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  app.log.info(`API listening on http://localhost:${env.PORT}`);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
