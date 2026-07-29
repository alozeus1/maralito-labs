/** Stand-in for `@/server/audit`. An audit write on a rejected request would itself be a defect. */
import { recordCall } from './state';

export async function writeAudit(_entry: unknown): Promise<void> {
  recordCall('@/server/audit', 'writeAudit');
}
