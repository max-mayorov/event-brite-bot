export function log(message: string, extra?: Record<string, unknown>): void {
  const payload = extra ? ` ${JSON.stringify(extra)}` : '';
  console.log(`[event-brite-bot] ${message}${payload}`);
}

export function logError(message: string, error: unknown): void {
  const detail = error instanceof Error ? { message: error.message, stack: error.stack } : { error };
  log(message, detail);
}
