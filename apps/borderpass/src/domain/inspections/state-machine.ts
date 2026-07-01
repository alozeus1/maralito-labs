/**
 * Inspection sub-status machine (Phase 6, ADR-0012). Pure, status-only (staff/system-driven; the action
 * layer enforces staff authorization). This is a DOMAIN machine on the inspection record — it does NOT add
 * order states. The order is driven only at its existing join points via transitionOrder (Increment 6.2).
 */
export const INSPECTION_STATUSES = ['scheduled', 'in_progress', 'on_hold', 'passed', 'failed'] as const;
export type InspectionStatus = (typeof INSPECTION_STATUSES)[number];

export type InspectionResult = 'passed' | 'failed';

/** Legal transitions (status-only). Mirrors the order/payment machine style. */
export const LEGAL_INSPECTION_TRANSITIONS: Record<InspectionStatus, readonly InspectionStatus[]> = {
  scheduled: ['in_progress'],
  in_progress: ['on_hold', 'passed', 'failed'],
  on_hold: ['in_progress'],
  passed: [],
  failed: [],
};

const TERMINAL: readonly InspectionStatus[] = ['passed', 'failed'];

export function isLegalInspectionTransition(from: InspectionStatus, to: InspectionStatus): boolean {
  return LEGAL_INSPECTION_TRANSITIONS[from]?.includes(to) ?? false;
}
export function getNextAllowedInspectionStatuses(from: InspectionStatus): InspectionStatus[] {
  return [...(LEGAL_INSPECTION_TRANSITIONS[from] ?? [])];
}
export function isTerminalInspectionStatus(status: InspectionStatus): boolean {
  return TERMINAL.includes(status);
}
/** The result a terminal status implies (for the inspection.result column + order join), else null. */
export function inspectionResultFor(status: InspectionStatus): InspectionResult | null {
  if (status === 'passed') return 'passed';
  if (status === 'failed') return 'failed';
  return null;
}
export class IllegalInspectionTransitionError extends Error {
  constructor(readonly from: InspectionStatus, readonly to: InspectionStatus) {
    super(`illegal inspection transition: ${from} → ${to}`);
    this.name = 'IllegalInspectionTransitionError';
  }
}
export function assertInspectionTransition(from: InspectionStatus, to: InspectionStatus): void {
  if (!isLegalInspectionTransition(from, to)) throw new IllegalInspectionTransitionError(from, to);
}
