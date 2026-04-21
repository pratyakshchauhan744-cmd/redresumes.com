import { jobDeduplicationQueue, jobIndexingQueue, jobIngestionQueue, notificationsQueue } from "./queues.js";

export async function enqueueIngestion(source: "adzuna" | "jooble"): Promise<void> {
  await jobIngestionQueue.add("fetch-jobs", { source }, { removeOnComplete: true });
}

export async function enqueueJobDeduplication(jobId: string): Promise<void> {
  await jobDeduplicationQueue.add("dedupe-job", { jobId }, { removeOnComplete: true });
}

export async function enqueueJobIndexing(jobId: string): Promise<void> {
  await jobIndexingQueue.add("index-job", { jobId }, { removeOnComplete: true });
}

export async function enqueueNotification(payload: { userId: string; message: string }): Promise<void> {
  await notificationsQueue.add("send-notification", payload, { removeOnComplete: true });
}
