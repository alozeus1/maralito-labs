/**
 * REFERENCE ONLY — the real LangGraph (PostgresSaver) × Inngest pattern.
 * Not executed in the Phase 0 sandbox (no Postgres/Docker). Run in a real dev env.
 * Verified package: @langchain/langgraph@1.4.7 exists. ⚠️ VERIFY exact checkpoint-postgres version on install:
 *   pnpm add @langchain/langgraph @langchain/langgraph-checkpoint-postgres inngest pg
 */
import { Inngest } from 'inngest';
// import { StateGraph, Annotation, interrupt, Command } from '@langchain/langgraph';
// import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';

export const inngest = new Inngest({ id: 'borderpass' });

/**
 * Pattern:
 * 1. Build a LangGraph graph with a PostgresSaver checkpointer (thread_id = order_id).
 *      const checkpointer = PostgresSaver.fromConnString(process.env.LANGGRAPH_CHECKPOINT_DB_URL!);
 *      const graph = workflow.compile({ checkpointer });
 * 2. The graph reaches a human-approval node that calls interrupt({ kind: 'risk_approval' }).
 *    LangGraph persists the checkpoint to Postgres and yields control.
 * 3. The Inngest function durably waits for the approval event (survives restarts):
 *      const decision = await step.waitForEvent('await-approval', {
 *        event: 'borderpass/risk.decided', timeout: '7d',
 *        match: 'data.order_id',
 *      });
 * 4. On the signal, resume by thread_id with the human's decision:
 *      await step.run('resume-graph', () =>
 *        graph.invoke(new Command({ resume: decision.data }), { configurable: { thread_id: orderId } }));
 *    Completed nodes are NOT re-run (checkpoint resumes mid-graph).
 *
 * Fallback (Plan B) if checkpointer×Inngest integration is unsatisfactory:
 *   Keep the pause at the Inngest layer (step.waitForEvent) and persist LangGraph state to a
 *   `agent_checkpoints` table manually; rehydrate on resume. Same external behavior.
 */
export const riskReviewWorkflow = inngest.createFunction(
  { id: 'risk-review' },
  { event: 'borderpass/order.under_review' },
  async ({ event, step }) => {
    const orderId = event.data.order_id as string;
    // step 1+2: run agent graph until interrupt (recommend-only; persists checkpoint)
    // step 3: durable wait for human approval
    const decision = await step.waitForEvent('await-approval', {
      event: 'borderpass/risk.decided',
      timeout: '7d',
      match: 'data.order_id',
    });
    // step 4: resume graph by thread_id with the decision (no node re-run)
    return { orderId, resumed: Boolean(decision) };
  },
);
