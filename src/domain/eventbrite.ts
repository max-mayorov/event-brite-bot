import { EventInspection, WatchStatus } from '../types';

const moneyPattern = /[$€£]\s?\d|\b\d+(?:[.,]\d{2})?\s?(usd|eur|gbp)\b/i;

export function inferEventbriteStatusFromText(text: string): {
  status: WatchStatus;
  isFree: boolean;
  details: string;
} {
  const normalized = text.toLowerCase();
  const isFree = normalized.includes('free') && !moneyPattern.test(normalized);

  if (normalized.includes('sold out') || normalized.includes('unavailable') || normalized.includes('not available')) {
    return { status: 'sold_out', isFree, details: 'Tickets appear to be sold out or unavailable.' };
  }

  if (normalized.includes('waitlist')) {
    return { status: 'waitlist', isFree, details: 'The page mentions a waitlist.' };
  }

  if (
    normalized.includes('registration closed') ||
    normalized.includes('sales ended') ||
    normalized.includes('event has ended') ||
    normalized.includes('no longer on sale')
  ) {
    return { status: 'closed', isFree, details: 'The registration flow appears to be closed.' };
  }

  if (
    normalized.includes('get tickets') ||
    normalized.includes('tickets') ||
    normalized.includes('register') ||
    normalized.includes('reserve a spot') ||
    normalized.includes('select tickets')
  ) {
    return { status: 'available', isFree, details: 'The page exposes a registration call-to-action.' };
  }

  return { status: 'unknown', isFree, details: 'Unable to confidently determine ticket availability.' };
}

export function formatInspectionMessage(inspection: EventInspection): string {
  return [
    `Status: ${inspection.status}`,
    inspection.title ? `Title: ${inspection.title}` : undefined,
    `Free flow: ${inspection.isFree ? 'yes' : 'no or unknown'}`,
    inspection.ctaText ? `CTA: ${inspection.ctaText}` : undefined,
    `Details: ${inspection.details}`,
    `URL: ${inspection.url}`
  ]
    .filter(Boolean)
    .join('\n');
}
