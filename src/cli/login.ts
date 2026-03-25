import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { chromium } from 'playwright';
import { loadConfig } from '../config';
import { ensureDirectory } from '../lib/fs';
import { log } from '../lib/logger';

async function main(): Promise<void> {
  const config = loadConfig();
  await ensureDirectory(config.browserProfileDir);
  await ensureDirectory(config.dataDir);

  const context = await chromium.launchPersistentContext(config.browserProfileDir, {
    headless: false
  });

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto('https://www.eventbrite.com/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    log('Complete login in the opened browser window, then press Enter here to save the session.');

    const rl = readline.createInterface({ input, output });
    await rl.question('');
    rl.close();

    await ensureDirectory(config.dataDir);
    await context.storageState({ path: config.authStoragePath });
    log(`Saved auth state to ${config.authStoragePath}`);
  } finally {
    await context.close();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
