type LogContext = Record<string, unknown>;

export function createLogger(service: string) {
  function write(level: string, message: string, context: LogContext = {}) {
    console.log(JSON.stringify({
      level,
      service,
      message,
      ...context,
      time: new Date().toISOString()
    }));
  }

  return {
    info: (message: string, context?: LogContext) => write("info", message, context),
    warn: (message: string, context?: LogContext) => write("warn", message, context),
    error: (message: string, context?: LogContext) => write("error", message, context)
  };
}

