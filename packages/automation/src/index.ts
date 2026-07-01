/**
 * @maralito/automation — PLACEHOLDER (Phase 0). Inngest durable-workflow client structure.
 * The 25-status order machine IS the durable workflow; human gates = approval steps.
 * TODO(phase10): Inngest client + W1–W15 workflow definitions + saga compensation + DLQ.
 */
export interface AutomationConfig {
  eventKey: string; // INNGEST_EVENT_KEY (server-only)
  signingKey: string; // INNGEST_SIGNING_KEY (server-only)
}
export type WorkflowStepType =
  'function' | 'agent' | 'approval' | 'task' | 'wait' | 'signal' | 'effect' | 'subworkflow';
