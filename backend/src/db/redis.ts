import { Redis } from "ioredis";
import { env } from "../config/env.js";

export const redisConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
  enableOfflineQueue: false,
  retryStrategy: (times) => {
    // Stop retrying after 3 attempts to avoid log spam
    if (times > 3) return null;
    return Math.min(times * 1000, 3000);
  },
});

// Prevent unhandled error events from crashing the process
redisConnection.on("error", (err: any) => {
  // Only log once to avoid spam
  if (err.code === "ECONNREFUSED" || err.name === "AggregateError") {
    // Redis not available - queues/caching will be disabled but app continues
    console.warn("[Redis] Connection unavailable - queue features disabled:", err.message);
  } else {
    console.error("[Redis] Unexpected error:", err.message);
  }
});

