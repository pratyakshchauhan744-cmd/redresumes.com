import { app } from "./app.js";
import { env } from "./config/env.js";
import { ensureJobsIndex } from "./modules/search/search.service.js";

async function bootstrap(): Promise<void> {
  await ensureJobsIndex();

  app.listen(env.PORT, () => {
    console.log(`API server listening on port ${env.PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
