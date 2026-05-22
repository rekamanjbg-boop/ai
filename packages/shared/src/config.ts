import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.string().default("info"),
  CORS_ORIGIN: z.string().default("*"),
  BODY_LIMIT: z.string().default("10mb"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  COMFYUI_BASE_URL: z.string().default("http://localhost:8188"),
  COMFYUI_API_KEY: z.string().optional(),
  COMFYUI_TIMEOUT_MS: z.coerce.number().default(120000),
  COMFYUI_POLL_INTERVAL_MS: z.coerce.number().default(2000),
  COMFYUI_MAX_POLL_ATTEMPTS: z.coerce.number().default(120),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  WORKER_ROLE: z.enum(["all", "generation", "rendering", "delivery", "remotion", "sync"]).default("all"),
  LOCAL_STORAGE_ROOT: z.string().default("./data/media"),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(false),
  S3_SIGNED_URL_TTL_SECONDS: z.coerce.number().default(3600),
  STORAGE_UPLOAD_RETRIES: z.coerce.number().default(3),
  NEXTCLOUD_WEBDAV_URL: z.string().optional(),
  NEXTCLOUD_USERNAME: z.string().optional(),
  NEXTCLOUD_PASSWORD: z.string().optional(),
  NEXTCLOUD_ROOT_FOLDER: z.string().default("/AI Media Platform"),
  NEXTCLOUD_UPLOAD_RETRIES: z.coerce.number().default(3),
  SYNC_CONCURRENCY: z.coerce.number().default(2),
  REPLICATE_API_TOKEN: z.string().optional(),
  REPLICATE_MODEL_OWNER: z.string().optional(),
  REPLICATE_MODEL_NAME: z.string().optional(),
  REPLICATE_MODEL_VERSION: z.string().optional(),
  REPLICATE_DEPLOYMENT_OWNER: z.string().optional(),
  REPLICATE_DEPLOYMENT_NAME: z.string().optional(),
  REPLICATE_POLL_INTERVAL_MS: z.coerce.number().default(5000),
  REPLICATE_MAX_POLL_ATTEMPTS: z.coerce.number().default(240),
  REPLICATE_CANCEL_AFTER: z.string().default("30m"),
  VIDEO_GENERATION_CONCURRENCY: z.coerce.number().default(1),
  RENDER_CONCURRENCY: z.coerce.number().default(2),
  GENERATION_CONCURRENCY: z.coerce.number().default(2)
});

export type RuntimeConfig = ReturnType<typeof loadConfig>;

export function loadConfig() {
  const env = envSchema.parse(process.env);

  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    corsOrigin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN,
    bodyLimit: env.BODY_LIMIT,
    redisUrl: env.REDIS_URL,
    comfyUiBaseUrl: env.COMFYUI_BASE_URL,
    comfyUiApiKey: env.COMFYUI_API_KEY,
    comfyUiTimeoutMs: env.COMFYUI_TIMEOUT_MS,
    comfyUiPollIntervalMs: env.COMFYUI_POLL_INTERVAL_MS,
    comfyUiMaxPollAttempts: env.COMFYUI_MAX_POLL_ATTEMPTS,
    storageDriver: env.STORAGE_DRIVER,
    workerRole: env.WORKER_ROLE,
    localStorageRoot: env.LOCAL_STORAGE_ROOT,
    s3: {
      region: env.S3_REGION,
      bucket: env.S3_BUCKET,
      endpoint: env.S3_ENDPOINT,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      signedUrlTtlSeconds: env.S3_SIGNED_URL_TTL_SECONDS
    },
    storageUploadRetries: env.STORAGE_UPLOAD_RETRIES,
    nextcloud: {
      webdavUrl: env.NEXTCLOUD_WEBDAV_URL,
      username: env.NEXTCLOUD_USERNAME,
      password: env.NEXTCLOUD_PASSWORD,
      rootFolder: env.NEXTCLOUD_ROOT_FOLDER,
      uploadRetries: env.NEXTCLOUD_UPLOAD_RETRIES
    },
    syncConcurrency: env.SYNC_CONCURRENCY,
    replicate: {
      apiToken: env.REPLICATE_API_TOKEN,
      modelOwner: env.REPLICATE_MODEL_OWNER,
      modelName: env.REPLICATE_MODEL_NAME,
      modelVersion: env.REPLICATE_MODEL_VERSION,
      deploymentOwner: env.REPLICATE_DEPLOYMENT_OWNER,
      deploymentName: env.REPLICATE_DEPLOYMENT_NAME,
      pollIntervalMs: env.REPLICATE_POLL_INTERVAL_MS,
      maxPollAttempts: env.REPLICATE_MAX_POLL_ATTEMPTS,
      cancelAfter: env.REPLICATE_CANCEL_AFTER
    },
    videoGenerationConcurrency: env.VIDEO_GENERATION_CONCURRENCY,
    renderConcurrency: env.RENDER_CONCURRENCY,
    generationConcurrency: env.GENERATION_CONCURRENCY
  };
}
