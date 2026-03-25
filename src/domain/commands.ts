import { WatchMode } from '../types';

export interface ParsedWatchRequest {
  eventUrl: string;
  desiredTicketText?: string;
  checkIntervalMinutes?: number;
  mode: WatchMode;
}

export function tokenizeQuotedArgs(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | undefined;

  for (const character of input) {
    if (quote) {
      if (character === quote) {
        quote = undefined;
      } else {
        current += character;
      }
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }

    if (/\s/.test(character)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += character;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

export function parseWatchRequest(input: string, mode: WatchMode): ParsedWatchRequest {
  const tokens = tokenizeQuotedArgs(input.trim());
  const [eventUrl, ...rest] = tokens;

  if (!eventUrl || !/^https?:\/\/(www\.)?eventbrite\./i.test(eventUrl)) {
    throw new Error('Please provide a valid Eventbrite URL.');
  }

  const request: ParsedWatchRequest = { eventUrl, mode };

  for (const token of rest) {
    if (token.startsWith('--every=')) {
      const minutes = Number.parseInt(token.split('=')[1] ?? '', 10);
      if (!Number.isFinite(minutes) || minutes <= 0) {
        throw new Error('The --every flag must be a positive number of minutes.');
      }
      request.checkIntervalMinutes = minutes;
      continue;
    }

    if (token.startsWith('--ticket=')) {
      const value = token.split('=').slice(1).join('=').trim();
      if (!value) {
        throw new Error('The --ticket flag cannot be empty.');
      }
      request.desiredTicketText = value;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return request;
}
