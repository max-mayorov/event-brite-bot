import crypto from 'node:crypto';

export function createId(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(4).toString('hex')}`;
}
