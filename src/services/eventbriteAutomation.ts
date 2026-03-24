import { access } from 'node:fs/promises';
import { chromium, BrowserContext, Page } from 'playwright';
import { AppConfig } from '../config';
import { inferEventbriteStatusFromText } from '../domain/eventbrite';
import { log } from '../lib/logger';
import { EventInspection, RegistrationResult } from '../types';

export class EventbriteAutomation {
  public constructor(private readonly config: AppConfig) {}

  public async hasAuthState(): Promise<boolean> {
    try {
      await access(this.config.authStoragePath);
      return true;
    } catch {
      return false;
    }
  }

  public async inspectEvent(eventUrl: string): Promise<EventInspection> {
    return this.withContext(async (context, page) => {
      await page.goto(eventUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForTimeout(2_000);

      const title = await page.title().catch(() => undefined);
      const bodyText = await page.locator('body').innerText().catch(() => '');
      const ctaText = await this.findCtaText(page);
      const inferred = inferEventbriteStatusFromText(`${bodyText}\n${ctaText ?? ''}`);

      return {
        url: eventUrl,
        title,
        ctaText,
        status: inferred.status,
        isFree: inferred.isFree,
        details: inferred.details
      };
    });
  }

  public async attemptFreeRegistration(eventUrl: string, desiredTicketText?: string): Promise<RegistrationResult> {
    return this.withContext(async (context, page) => {
      await page.goto(eventUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForTimeout(2_000);

      const title = await page.title().catch(() => undefined);
      const initialText = await page.locator('body').innerText().catch(() => '');
      const initialStatus = inferEventbriteStatusFromText(initialText);
      if (!initialStatus.isFree) {
        return {
          success: false,
          status: initialStatus.status === 'available' ? 'unknown' : initialStatus.status,
          summary: 'Auto-registration only proceeds when the page looks free and no price is detected.',
          title
        };
      }

      const opened = await this.clickFirstMatch(page, [
        /^get tickets$/i,
        /^tickets$/i,
        /^register$/i,
        /^reserve a spot$/i,
        /^select tickets$/i
      ]);

      if (opened) {
        await page.waitForLoadState('domcontentloaded').catch(() => undefined);
        await page.waitForTimeout(2_000);
      }

      await this.selectTicketQuantity(page, desiredTicketText);

      const confirmed = await this.clickFirstMatch(page, [
        /^checkout$/i,
        /^register$/i,
        /^place order$/i,
        /^complete order$/i,
        /^order now$/i
      ]);

      if (confirmed) {
        await page.waitForLoadState('domcontentloaded').catch(() => undefined);
        await page.waitForTimeout(3_000);
      }

      const finalText = await page.locator('body').innerText().catch(() => '');
      const normalized = finalText.toLowerCase();
      if (
        normalized.includes("you're going") ||
        normalized.includes('you’re going') ||
        normalized.includes('order confirmed') ||
        normalized.includes('registration complete') ||
        normalized.includes('ticket order confirmed')
      ) {
        return {
          success: true,
          status: 'registered',
          summary: 'Free registration appears to have completed successfully.',
          title
        };
      }

      return {
        success: false,
        status: 'available',
        summary: 'The free registration flow did not reach a confirmation page automatically.',
        title
      };
    }, true);
  }

  private async withContext<T>(
    callback: (context: BrowserContext, page: Page) => Promise<T>,
    requireAuth = false
  ): Promise<T> {
    const hasAuthState = await this.hasAuthState();
    if (requireAuth && !hasAuthState) {
      throw new Error('No saved Eventbrite authentication state found. Run the login step first.');
    }

    const browser = await chromium.launch({ headless: this.config.playwrightHeadless });
    const context = await browser.newContext(
      hasAuthState
        ? {
            storageState: this.config.authStoragePath
          }
        : undefined
    );

    try {
      const page = await context.newPage();
      return await callback(context, page);
    } finally {
      await context.close();
      await browser.close();
    }
  }

  private async findCtaText(page: Page): Promise<string | undefined> {
    const texts = await page
      .locator('a, button')
      .evaluateAll((elements) =>
        elements
          .map((element) => element.textContent?.trim() ?? '')
          .filter(Boolean)
          .slice(0, 100)
      )
      .catch(() => []);

    return texts.find((text) => /get tickets|tickets|register|reserve a spot|select tickets|waitlist/i.test(text));
  }

  private async clickFirstMatch(page: Page, patterns: RegExp[]): Promise<boolean> {
    for (const pattern of patterns) {
      const button = page.getByRole('button', { name: pattern }).first();
      if (await button.isVisible().catch(() => false)) {
        log('Clicking button', { pattern: pattern.source });
        await button.click();
        return true;
      }

      const link = page.getByRole('link', { name: pattern }).first();
      if (await link.isVisible().catch(() => false)) {
        log('Clicking link', { pattern: pattern.source });
        await link.click();
        return true;
      }
    }

    return false;
  }

  private async selectTicketQuantity(page: Page, desiredTicketText?: string): Promise<void> {
    if (desiredTicketText) {
      const ticketRow = page.getByText(new RegExp(desiredTicketText, 'i')).first();
      if (await ticketRow.isVisible().catch(() => false)) {
        await ticketRow.scrollIntoViewIfNeeded().catch(() => undefined);
      }
    }

    const select = page.locator('select').first();
    if (await select.isVisible().catch(() => false)) {
      const options = await select.locator('option').allTextContents().catch(() => []);
      const canPickOne = options.some((option) => option.trim() === '1');
      if (canPickOne) {
        await select.selectOption('1').catch(() => undefined);
      }
    }
  }
}
