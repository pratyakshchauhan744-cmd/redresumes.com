import { env } from "./config/env.js";
import { app } from "./app.js";
import { ensureJobsIndex } from "./modules/search/search.service.js";
import { prisma } from "./db/prisma.js";

async function bootstrap(): Promise<void> {
  const port = Number(process.env.PORT) || env.PORT || 4000;

  app.listen(port, "0.0.0.0", () => {
    console.log(`API server listening on 0.0.0.0:${port}`);
  });

  // Establish the remote connection while the frontend starts, instead of
  // making the first login pay the complete DNS/TCP/TLS handshake.
  void prisma.$connect().catch(() => {
    console.warn("Database warmup unavailable; requests will retry connecting.");
  });

  ensureJobsIndex().catch((error) => {
    console.warn("Search index init skipped:", error instanceof Error ? error.message : "unknown error");
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
