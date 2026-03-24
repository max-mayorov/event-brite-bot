import { Context, Telegraf } from 'telegraf';
import { AppConfig } from './config';
import { parseWatchRequest } from './domain/commands';
import { createId } from './lib/ids';
import { EventbriteAutomation } from './services/eventbriteAutomation';
import { WatchScheduler } from './services/watchScheduler';
import { WatchStore } from './store/watchStore';
import { EventWatch, WatchMode } from './types';

function helpText(config: AppConfig): string {
  return [
    'Commands:',
    '/start - show a short introduction',
    '/help - show all commands',
    '/login - explain how to save Eventbrite authentication',
    '/loginstatus - show whether an auth session is saved',
    '/watch <eventbrite-url> [--every=15] [--ticket="General Admission"] - notify on status changes',
    '/watchfree <eventbrite-url> [--every=15] [--ticket="General Admission"] - try free auto-registration when enabled',
    '/list - list active watches',
    '/pause <watch-id> - pause a watch',
    '/resume <watch-id> - resume a watch',
    '/remove <watch-id> - delete a watch',
    '/run [watch-id] - trigger an immediate check',
    '',
    `Guardrails: minimum interval is ${config.minCheckIntervalMinutes} minutes, checks are serialized, and free auto-registration is ${config.allowAutoRegisterFreeOnly ? 'enabled' : 'disabled'}.`
  ].join('\n');
}

function loginText(config: AppConfig): string {
  return [
    'Choose one login flow:',
    `1) Local headed browser: run "npm run login" from ${process.cwd()} and complete login manually.`,
    '2) Attach to your own Chrome/Chromium session:',
    '   - Start Chrome with remote debugging, for example:',
    '     google-chrome --remote-debugging-port=9222 --user-data-dir=$HOME/.eventbrite-bot-profile',
    '   - Log in to Eventbrite in that browser.',
    '   - Save the session with: npm run auth:attach -- http://127.0.0.1:9222',
    '',
    `Saved auth state path: ${config.authStoragePath}`
  ].join('\n');
}

function formatWatch(watch: EventWatch): string {
  return [
    `${watch.id} ${watch.paused ? '⏸' : '▶'} ${watch.mode}`,
    `${watch.eventUrl}`,
    `every ${watch.checkIntervalMinutes}m`,
    watch.lastStatus ? `status=${watch.lastStatus}` : undefined,
    watch.lastTitle ? `title=${watch.lastTitle}` : undefined,
    watch.lastError ? `error=${watch.lastError}` : undefined,
    `next=${watch.nextRunAt}`
  ]
    .filter(Boolean)
    .join(' | ');
}

function createWatch(chatId: string, request: ReturnType<typeof parseWatchRequest>, config: AppConfig): EventWatch {
  const now = new Date().toISOString();
  const effectiveInterval = Math.max(config.minCheckIntervalMinutes, request.checkIntervalMinutes ?? config.defaultCheckIntervalMinutes);

  return {
    id: createId('watch'),
    chatId,
    eventUrl: request.eventUrl,
    desiredTicketText: request.desiredTicketText,
    checkIntervalMinutes: effectiveInterval,
    mode: request.mode,
    paused: false,
    createdAt: now,
    updatedAt: now,
    nextRunAt: now
  };
}

export function createBot(
  config: AppConfig,
  store: WatchStore,
  automation: EventbriteAutomation,
  scheduler: WatchScheduler
): Telegraf {
  const bot = new Telegraf(config.telegramBotToken);

  const getMessageText = (context: Context): string =>
    context.message && 'text' in context.message ? context.message.text : '';

  bot.start(async (context) => {
    await context.reply('Eventbrite subscription agent is running.\nUse /help to see available commands.');
  });

  bot.help(async (context) => {
    await context.reply(helpText(config));
  });

  bot.command('login', async (context) => {
    await context.reply(loginText(config));
  });

  bot.command('loginstatus', async (context) => {
    await context.reply((await automation.hasAuthState()) ? 'Saved Eventbrite auth state is available.' : 'No auth state saved yet.');
  });

  bot.command('watch', async (context) => {
    await handleWatchCommand(
      getMessageText(context).replace(/^\/watch(@\w+)?\s*/i, ''),
      'notify',
      context.chat.id.toString(),
      async (message) => context.reply(message)
    );
  });

  bot.command('watchfree', async (context) => {
    await handleWatchCommand(
      getMessageText(context).replace(/^\/watchfree(@\w+)?\s*/i, ''),
      'auto-register-free',
      context.chat.id.toString(),
      async (message) => context.reply(message)
    );
  });

  bot.command('list', async (context) => {
    const watches = (await store.list()).filter((watch) => watch.chatId === context.chat.id.toString());
    if (watches.length === 0) {
      await context.reply('No watches configured for this chat.');
      return;
    }

    await context.reply(watches.map((watch) => formatWatch(watch)).join('\n\n'));
  });

  bot.command('remove', async (context) => {
    const watchId = getMessageText(context).replace(/^\/remove(@\w+)?\s*/i, '').trim();
    if (!watchId) {
      await context.reply('Usage: /remove <watch-id>');
      return;
    }

    const watch = await store.getById(watchId);
    if (!watch || watch.chatId !== context.chat.id.toString()) {
      await context.reply(`Watch ${watchId} was not found.`);
      return;
    }

    const removed = await store.remove(watchId);
    await context.reply(removed ? `Removed ${watchId}.` : `Watch ${watchId} was not found.`);
  });

  bot.command('pause', async (context) => {
    await togglePause(getMessageText(context), true, context.chat.id.toString(), async (message) => context.reply(message));
  });

  bot.command('resume', async (context) => {
    await togglePause(getMessageText(context), false, context.chat.id.toString(), async (message) => context.reply(message));
  });

  bot.command('run', async (context) => {
    const watchId = getMessageText(context).replace(/^\/run(@\w+)?\s*/i, '').trim() || undefined;
    await context.reply(await scheduler.runNow(watchId));
  });

  async function handleWatchCommand(
    rawInput: string,
    mode: WatchMode,
    chatId: string,
    reply: (message: string) => Promise<unknown>
  ): Promise<void> {
    try {
      const request = parseWatchRequest(rawInput, mode);
      const watch = createWatch(chatId, request, config);
      await store.upsert(watch);
      await reply(`Created ${watch.id} for ${watch.eventUrl} (${watch.mode}, every ${watch.checkIntervalMinutes}m).`);
    } catch (error) {
      await reply(error instanceof Error ? error.message : 'Failed to create a watch.');
    }
  }

  async function togglePause(
    rawText: string,
    paused: boolean,
    chatId: string,
    reply: (message: string) => Promise<unknown>
  ): Promise<void> {
    const command = paused ? 'pause' : 'resume';
    const watchId = rawText.replace(new RegExp(`^/${command}(@\\w+)?\\s*`, 'i'), '').trim();
    if (!watchId) {
      await reply(`Usage: /${command} <watch-id>`);
      return;
    }

    const watch = await store.getById(watchId);
    if (!watch || watch.chatId !== chatId) {
      await reply(`Watch ${watchId} was not found.`);
      return;
    }

    watch.paused = paused;
    watch.updatedAt = new Date().toISOString();
    await store.upsert(watch);
    await reply(`${paused ? 'Paused' : 'Resumed'} ${watch.id}.`);
  }

  return bot;
}
