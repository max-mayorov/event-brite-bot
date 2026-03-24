import { AppConfig } from '../config';
import { formatInspectionMessage } from '../domain/eventbrite';
import { log, logError } from '../lib/logger';
import { EventbriteAutomation } from './eventbriteAutomation';
import { WatchStore } from '../store/watchStore';
import { EventWatch } from '../types';

type NotifyFn = (chatId: string, message: string) => Promise<void>;

export class WatchScheduler {
  private timer?: NodeJS.Timeout;
  private readonly inFlight = new Set<string>();

  public constructor(
    private readonly config: AppConfig,
    private readonly store: WatchStore,
    private readonly automation: EventbriteAutomation,
    private readonly notify: NotifyFn
  ) {}

  public start(): void {
    this.timer = setInterval(() => {
      void this.runDueWatches();
    }, this.config.watchPollIntervalSeconds * 1_000);
    void this.runDueWatches();
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  public async runNow(watchId?: string): Promise<string> {
    const watches = await this.store.list();
    const filteredWatches = watchId ? watches.filter((watch) => watch.id === watchId) : watches;
    if (filteredWatches.length === 0) {
      return watchId ? `Watch ${watchId} was not found.` : 'No watches configured.';
    }

    for (const watch of filteredWatches) {
      await this.processWatch(watch, true);
    }

    return `Triggered ${filteredWatches.length} watch run(s).`;
  }

  private async runDueWatches(): Promise<void> {
    const watches = await this.store.list();
    const now = Date.now();

    for (const watch of watches) {
      if (watch.paused || this.inFlight.has(watch.id)) {
        continue;
      }

      if (new Date(watch.nextRunAt).getTime() <= now) {
        await this.processWatch(watch, false);
      }
    }
  }

  private async processWatch(watch: EventWatch, forced: boolean): Promise<void> {
    this.inFlight.add(watch.id);

    try {
      log('Processing watch', { id: watch.id, url: watch.eventUrl, forced });
      const inspection = await this.automation.inspectEvent(watch.eventUrl);
      watch.lastCheckedAt = new Date().toISOString();
      watch.updatedAt = watch.lastCheckedAt;
      watch.lastStatus = inspection.status;
      watch.lastTitle = inspection.title;
      watch.lastError = undefined;
      watch.nextRunAt = this.computeNextRunAt(watch.checkIntervalMinutes);

      let message = `Watch ${watch.id} checked.\n${formatInspectionMessage(inspection)}`;

      if (
        watch.mode === 'auto-register-free' &&
        inspection.status === 'available' &&
        inspection.isFree &&
        this.config.allowAutoRegisterFreeOnly
      ) {
        const result = await this.automation.attemptFreeRegistration(watch.eventUrl, watch.desiredTicketText);
        watch.lastStatus = result.status;
        watch.updatedAt = new Date().toISOString();
        message = `Watch ${watch.id} attempted auto-registration.\n${result.summary}`;
      }

      const shouldNotify =
        forced ||
        watch.lastNotifiedStatus !== watch.lastStatus ||
        watch.lastStatus === 'available' ||
        watch.lastStatus === 'registered';

      if (shouldNotify) {
        await this.notify(watch.chatId, message);
        watch.lastNotifiedStatus = watch.lastStatus;
      }

      await this.store.upsert(watch);
    } catch (error) {
      logError('Watch processing failed', error);
      watch.lastCheckedAt = new Date().toISOString();
      watch.updatedAt = watch.lastCheckedAt;
      watch.lastStatus = 'error';
      watch.lastError = error instanceof Error ? error.message : 'Unknown error';
      watch.nextRunAt = this.computeNextRunAt(watch.checkIntervalMinutes);
      await this.store.upsert(watch);
      await this.notify(watch.chatId, `Watch ${watch.id} failed: ${watch.lastError}`);
    } finally {
      this.inFlight.delete(watch.id);
    }
  }

  private computeNextRunAt(checkIntervalMinutes: number): string {
    const jitterSeconds = Math.floor(Math.random() * 30);
    return new Date(Date.now() + checkIntervalMinutes * 60_000 + jitterSeconds * 1_000).toISOString();
  }
}
