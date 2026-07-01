/** Customer/staff-safe inspection status label (Phase 6, ADR-0012). Pure. No PII. */
import type { InspectionStatus } from './state-machine';

export function inspectionStatusLabel(status: InspectionStatus): string {
  switch (status) {
    case 'scheduled':
      return 'Scheduled';
    case 'in_progress':
      return 'In progress';
    case 'on_hold':
      return 'On hold';
    case 'passed':
      return 'Passed';
    case 'failed':
      return 'Failed';
  }
}
