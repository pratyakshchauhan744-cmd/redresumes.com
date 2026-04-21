import { MeiliSearch } from "meilisearch";
import { env } from "../config/env.js";

export const meili = new MeiliSearch({
  host: env.MEILI_HOST,
  apiKey: env.MEILI_MASTER_KEY
});

export const JOBS_INDEX = "jobs";
