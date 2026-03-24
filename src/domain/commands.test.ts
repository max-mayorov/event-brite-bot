import { describe, expect, it } from 'vitest';
import { parseWatchRequest, tokenizeQuotedArgs } from './commands';

describe('tokenizeQuotedArgs', () => {
  it('keeps quoted chunks together', () => {
    expect(tokenizeQuotedArgs('https://eventbrite.com/e/demo --ticket="General Admission" --every=20')).toEqual([
      'https://eventbrite.com/e/demo',
      '--ticket=General Admission',
      '--every=20'
    ]);
  });
});

describe('parseWatchRequest', () => {
  it('parses a valid watch command', () => {
    expect(
      parseWatchRequest('https://www.eventbrite.com/e/demo --ticket="General Admission" --every=25', 'notify')
    ).toEqual({
      eventUrl: 'https://www.eventbrite.com/e/demo',
      desiredTicketText: 'General Admission',
      checkIntervalMinutes: 25,
      mode: 'notify'
    });
  });

  it('rejects non-eventbrite urls', () => {
    expect(() => parseWatchRequest('https://example.com/demo', 'notify')).toThrow('Please provide a valid Eventbrite URL.');
  });
});
