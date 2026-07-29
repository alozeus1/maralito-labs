/** Stand-in for `@/server/review-request`. Records that it was reached — never emails anyone. */
import { fakeState, recordCall, type FakeReviewResult } from './state';

export async function sendOrderReviewRequest(_orderId: string): Promise<FakeReviewResult> {
  recordCall('@/server/review-request', 'sendOrderReviewRequest');
  return fakeState.reviewResult;
}
