import { createBot } from './bot';
import { loadConfig } from './config';
import { ensureDirectory } from './lib/fs';
import { log, logError } from './lib/logger';
import { EventbriteAutomation } from './services/eventbriteAutomation';
import { WatchScheduler } from './services/watchScheduler';
import { WatchStore } from './store/watchStore';

async function main(): Promise<void> {
  const config = loadConfig();
  if (!config.telegramBotToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is required.');
  }

  await ensureDirectory(config.dataDir);

  const store = new WatchStore(config.watchFilePath);
  const automation = new EventbriteAutomation(config);
  let bot: ReturnType<typeof createBot> | undefined;
  const scheduler = new WatchScheduler(config, store, automation, async (chatId, message) => {
    if (!bot) {
      return;
    }

    await bot.telegram.sendMessage(chatId, message);
  });
  bot = createBot(config, store, automation, scheduler);

  scheduler.start();
  await bot.launch();
  log('Telegram bot started');

  const shutdown = async (signal: string) => {
    log(`Received ${signal}, shutting down`);
    scheduler.stop();
    bot?.stop(signal);
    process.exit(0);
  };

  process.once('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.once('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

void main().catch((error) => {
  logError('Fatal startup error', error);
  process.exit(1);
});
