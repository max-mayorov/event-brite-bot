export type WatchMode = 'notify' | 'auto-register-free';

export type WatchStatus =
  | 'unknown'
  | 'available'
  | 'sold_out'
  | 'waitlist'
  | 'closed'
  | 'registered'
  | 'error';

export interface EventWatch {
  id: string;
  chatId: string;
  eventUrl: string;
  desiredTicketText?: string;
  checkIntervalMinutes: number;
  mode: WatchMode;
  paused: boolean;
  createdAt: string;
  updatedAt: string;
  nextRunAt: string;
  lastCheckedAt?: string;
  lastStatus?: WatchStatus;
  lastNotifiedStatus?: WatchStatus;
  lastTitle?: string;
  lastError?: string;
}

export interface StoreState {
  watches: EventWatch[];
}

export interface EventInspection {
  url: string;
  title?: string;
  status: WatchStatus;
  isFree: boolean;
  ctaText?: string;
  details: string;
}

export interface RegistrationResult {
  success: boolean;
  status: WatchStatus;
  summary: string;
  title?: string;
}
