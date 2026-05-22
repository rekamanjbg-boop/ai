import { createWorkers } from "./workers/index.js";
import { loadConfig } from "@media/shared/config";
import { createLogger } from "@media/shared/logger";

const config = loadConfig();
const logger = createLogger("worker");

createWorkers(config);
logger.info("Media workers started");

