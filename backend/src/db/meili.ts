import { Meilisearch } from "meilisearch";
import { env } from "../config/env.js";

export const meili = new Meilisearch({
  host: env.MEILI_HOST,
  apiKey: env.MEILI_MASTER_KEY
});

export const JOBS_INDEX = "jobs";
