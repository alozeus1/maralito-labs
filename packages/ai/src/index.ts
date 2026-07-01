/**
 * @maralito/ai — PLACEHOLDER (Phase 0). LangGraph via the AI gateway (recommend-only).
 * No model-provider keys in app code. Agents = distinct principal ≤ the human they assist.
 * TODO(phase11): Manager + Intake/Risk/Quote agents, tool registry (scoped), guardrails, evals.
 */
export type Autonomy = 'suggest' | 'act_with_approval' | 'act_autonomously';

export interface AgentVerdict<T = unknown> {
  verdict: T;
  confidence: number; // 0..1
  explanation: string;
  recommended_next_action: string;
}
/** Hard rule (structural, not prompt): AI never finalizes risky/compliance/payment/refund actions. */
export const MVP_AUTONOMY: Autonomy = 'suggest';
