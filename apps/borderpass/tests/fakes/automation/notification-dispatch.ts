/** Stand-in for `@/server/notification-dispatch`. Records that it was reached — never sends. */
import { fakeState, recordCall, type FakeDispatchSummary } from './state';

export async function dispatchQueuedNotifications(
  _options: unknown,
): Promise<FakeDispatchSummary> {
  recordCall('@/server/notification-dispatch', 'dispatchQueuedNotifications');
  return fakeState.dispatchSummary;
}
