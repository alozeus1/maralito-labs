/**
 * Stand-in for `@maralito/db` — just enough of the privileged query surface used by
 * `/api/automation/notification-status`. Reaching `withPrivilegedDbAccess` at all is the signal the
 * test cares about: an unauthenticated caller must never get that far.
 */
import { fakeState, recordCall } from './state';

type SelectStage = { limit: (n: number) => Promise<{ status: string }[]> };

function fakeDb() {
  return {
    select: (_cols: unknown) => ({
      from: (_table: unknown) => ({
        where: (_pred: unknown): SelectStage => ({
          limit: async (_n: number) => (fakeState.outboxRow ? [fakeState.outboxRow] : []),
        }),
      }),
    }),
    update: (_table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: async (_pred: unknown): Promise<void> => {
          fakeState.updates.push(values);
        },
      }),
    }),
  };
}

export type FakeDb = ReturnType<typeof fakeDb>;

export async function withPrivilegedDbAccess<T>(
  _label: string,
  fn: (db: FakeDb) => Promise<T>,
): Promise<T> {
  recordCall('@maralito/db', 'withPrivilegedDbAccess');
  return fn(fakeDb());
}

/** Column markers — only ever handed to the faked `where`/`set`, never interpreted. */
export const notificationOutbox = {
  id: { name: 'id' },
  status: { name: 'status' },
} as const;
