import { Queue } from "bullmq";
import { redisConnection } from "../db/redis.js";

export const jobIngestionQueue = new Queue("job-ingestion", { connection: redisConnection });
export const jobDeduplicationQueue = new Queue("job-deduplication", { connection: redisConnection });
export const jobIndexingQueue = new Queue("job-indexing", { connection: redisConnection });
export const notificationsQueue = new Queue("notifications", { connection: redisConnection });
