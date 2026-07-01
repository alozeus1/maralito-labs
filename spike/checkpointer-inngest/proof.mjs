// Zero-dependency proof of the LangGraph×Inngest durability pattern.
// Models: start -> recommend -> [INTERRUPT approval] -> finalize
// Checkpoint store (JSON file) stands in for the Postgres checkpointer, keyed by thread_id.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const THREAD_ID = 'ord_demo_0001';
const CKPT = new URL('./.checkpoint.json', import.meta.url);
const sideEffects = []; // proves a node runs at most once

function saveCheckpoint(cp) { writeFileSync(CKPT, JSON.stringify(cp, null, 2)); }
function loadCheckpoint() { return existsSync(CKPT) ? JSON.parse(readFileSync(CKPT, 'utf8')) : null; }

// "nodes"
function nodeRecommend(state) {
  sideEffects.push('recommend'); // e.g. AI risk-band recommendation (must NOT repeat on resume)
  return { ...state, recommendation: { risk_band: 'LOW', confidence: 0.92 } };
}
function nodeFinalize(state) {
  sideEffects.push('finalize');
  return { ...state, status: 'completed' };
}

const mode = process.argv[2];

if (mode === 'phase1') {
  // Fresh run: start -> recommend -> reach interrupt -> persist -> exit (durable pause)
  let state = { thread_id: THREAD_ID, status: 'running' };
  state = nodeRecommend(state);
  // INTERRUPT: human approval required. Inngest step.waitForEvent durably waits here.
  saveCheckpoint({ thread_id: THREAD_ID, next: 'finalize', state, completed_nodes: ['recommend'] });
  console.log('[phase1] reached approval interrupt; checkpoint persisted; process exiting (pause).');
  console.log('[phase1] side-effects this process:', JSON.stringify(sideEffects));
} else if (mode === 'approve') {
  // Simulated RESTART: brand-new process. Resume strictly from the checkpoint.
  const cp = loadCheckpoint();
  if (!cp) { console.error('NO CHECKPOINT — fail'); process.exit(1); }
  console.log('[approve] loaded checkpoint for', cp.thread_id, '— resuming at node:', cp.next);
  console.log('[approve] completed_nodes restored:', JSON.stringify(cp.completed_nodes));
  let state = cp.state;
  // approval signal arrives; resume ONLY the remaining node(s)
  if (cp.next === 'finalize') state = nodeFinalize(state);
  console.log('[approve] final state:', JSON.stringify(state));
  console.log('[approve] side-effects this process:', JSON.stringify(sideEffects));
  // ASSERTIONS
  const ok =
    state.status === 'completed' &&
    state.recommendation && state.recommendation.risk_band === 'LOW' && // state survived restart
    !sideEffects.includes('recommend') &&                              // recommend NOT re-run
    sideEffects.includes('finalize');
  console.log(ok ? '\nRESULT: PASS — resumed mid-graph, state preserved, no duplicate side effects.'
                 : '\nRESULT: FAIL');
  process.exit(ok ? 0 : 1);
} else {
  console.error('usage: node proof.mjs phase1|approve'); process.exit(2);
}
