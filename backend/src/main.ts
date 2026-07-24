import { env } from "./config/env.js";
import { app } from "./app.js";
import { ensureJobsIndex } from "./modules/search/search.service.js";

async function bootstrap(): Promise<void> {
  app.listen(env.PORT, () => {
    console.log(`API server listening on port ${env.PORT}`);
  });

  ensureJobsIndex().catch((error) => {
    console.warn("Search index init skipped:", error instanceof Error ? error.message : "unknown error");
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
