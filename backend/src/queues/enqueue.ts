async function withQueues(
  action: (queues: typeof import("./queues.js")) => Promise<void>
): Promise<void> {
  try {
    const queues = await import("./queues.js");
    await action(queues);
  } catch (error) {
    console.warn(
      "Queue action skipped. Redis/BullMQ is unavailable:",
      error instanceof Error ? error.message : "unknown error"
    );
  }
}

export async function enqueueIngestion(source: "adzuna" | "jooble"): Promise<void> {
  await withQueues(async ({ jobIngestionQueue }) => {
    await jobIngestionQueue.add("fetch-jobs", { source }, { removeOnComplete: true });
  });
}

export async function enqueueJobDeduplication(jobId: string): Promise<void> {
  await withQueues(async ({ jobDeduplicationQueue }) => {
    await jobDeduplicationQueue.add("dedupe-job", { jobId }, { removeOnComplete: true });
  });
}

export async function enqueueJobIndexing(jobId: string): Promise<void> {
  await withQueues(async ({ jobIndexingQueue }) => {
    await jobIndexingQueue.add("index-job", { jobId }, { removeOnComplete: true });
  });
}

export async function enqueueNotification(payload: { userId: string; message: string }): Promise<void> {
  await withQueues(async ({ notificationsQueue }) => {
    await notificationsQueue.add("send-notification", payload, { removeOnComplete: true });
  });
}
