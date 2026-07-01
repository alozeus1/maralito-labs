import { randomBytes } from 'node:crypto';
/** Prefixed, time-sortable id. Phase 1 dev helper; replace with a real ULID lib later. */
export function newId(prefix: string): string {
  const time = Date.now().toString(36).padStart(9, '0');
  const rand = randomBytes(8).toString('hex');
  return `${prefix}_${time}${rand}`;
}
