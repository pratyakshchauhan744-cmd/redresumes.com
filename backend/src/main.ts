import { env } from "./config/env.js";
import { app } from "./app.js";
import { ensureJobsIndex } from "./modules/search/search.service.js";

async function bootstrap(): Promise<void> {
  const port = Number(process.env.PORT) || env.PORT || 4000;

  app.listen(port, "0.0.0.0", () => {
    console.log(`API server listening on 0.0.0.0:${port}`);
  });

  ensureJobsIndex().catch((error) => {
    console.warn("Search index init skipped:", error instanceof Error ? error.message : "unknown error");
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
