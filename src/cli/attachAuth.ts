import { chromium } from 'playwright';
import { loadConfig } from '../config';
import { ensureDirectory } from '../lib/fs';
import { log } from '../lib/logger';

async function main(): Promise<void> {
  const config = loadConfig();
  const endpoint = process.argv[2] ?? config.browserCdpUrl;
  if (!endpoint) {
    throw new Error('Provide a Chrome/Chromium CDP URL, for example: npm run auth:attach -- http://127.0.0.1:9222');
  }

  await ensureDirectory(config.dataDir);

  const browser = await chromium.connectOverCDP(endpoint);
  try {
    const context = browser.contexts()[0];
    if (!context) {
      throw new Error('No browser context was found on the target CDP endpoint.');
    }

    await context.storageState({ path: config.authStoragePath });
    log(`Saved auth state to ${config.authStoragePath}`);
  } finally {
    await browser.close();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
