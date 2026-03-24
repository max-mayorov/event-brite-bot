import path from 'node:path';

export interface AppConfig {
  telegramBotToken: string;
  dataDir: string;
  watchFilePath: string;
  authStoragePath: string;
  browserProfileDir: string;
  defaultCheckIntervalMinutes: number;
  minCheckIntervalMinutes: number;
  watchPollIntervalSeconds: number;
  playwrightHeadless: boolean;
  allowAutoRegisterFreeOnly: boolean;
  browserCdpUrl?: string;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function parseInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadConfig(): AppConfig {
  const dataDir = path.resolve(process.env.DATA_DIR ?? './data');
  const defaultCheckIntervalMinutes = Math.max(10, parseInteger(process.env.DEFAULT_CHECK_INTERVAL_MINUTES, 15));
  const minCheckIntervalMinutes = Math.max(5, parseInteger(process.env.MIN_CHECK_INTERVAL_MINUTES, 10));
  const watchPollIntervalSeconds = Math.max(30, parseInteger(process.env.WATCH_POLL_INTERVAL_SECONDS, 60));
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN ?? '';

  return {
    telegramBotToken,
    dataDir,
    watchFilePath: path.join(dataDir, 'watches.json'),
    authStoragePath: path.join(dataDir, 'auth', 'eventbrite-storage-state.json'),
    browserProfileDir: path.join(dataDir, 'browser-profile'),
    defaultCheckIntervalMinutes,
    minCheckIntervalMinutes,
    watchPollIntervalSeconds,
    playwrightHeadless: parseBoolean(process.env.PLAYWRIGHT_HEADLESS, true),
    allowAutoRegisterFreeOnly: parseBoolean(process.env.ALLOW_AUTO_REGISTER_FREE_ONLY, false),
    browserCdpUrl: process.env.BROWSER_CDP_URL || undefined
  };
}
