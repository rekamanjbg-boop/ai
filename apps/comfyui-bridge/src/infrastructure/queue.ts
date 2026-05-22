import { Queue, QueueEvents } from "bullmq";
import { QUEUES } from "@media/queue/queues";
import { getRedisConnectionOptions } from "@media/queue/redis";

export function createImageQueue(redisUrl: string) {
  const connection = getRedisConnectionOptions(redisUrl);
  const queue = new Queue(QUEUES.imageGeneration, { connection });
  const events = new QueueEvents(QUEUES.imageGeneration, { connection });

  return {
    queue,
    events,
    async close() {
      await Promise.all([
        queue.close(),
        events.close()
      ]);
    }
  };
}

export type ImageQueue = ReturnType<typeof createImageQueue>;
