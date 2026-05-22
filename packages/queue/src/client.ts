import { Queue } from "bullmq";
import { getRedisConnectionOptions } from "./redis.js";
import { QUEUES } from "./queues.js";

export function createQueueClient(redisUrl: string) {
  const connection = getRedisConnectionOptions(redisUrl);

  return {
    production: new Queue(QUEUES.production, { connection }),
    imageGeneration: new Queue(QUEUES.imageGeneration, { connection }),
    videoGeneration: new Queue(QUEUES.videoGeneration, { connection }),
    generation: new Queue(QUEUES.generation, { connection }),
    rendering: new Queue(QUEUES.rendering, { connection }),
    delivery: new Queue(QUEUES.delivery, { connection })
  };
}

export type QueueClient = ReturnType<typeof createQueueClient>;
