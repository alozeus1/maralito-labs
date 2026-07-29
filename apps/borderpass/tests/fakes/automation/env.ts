/** Stand-in for `@/server/env` so tests control `N8N_WEBHOOK_SECRET` without touching process.env. */
import { fakeState, recordCall, type FakeEnv } from './state';

export function getServerEnv(): FakeEnv {
  recordCall('@/server/env', 'getServerEnv');
  return fakeState.env;
}
