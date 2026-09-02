/**
 * Next.js instrumentation hook — runs once per server process at start-up.
 *
 * Wires the observability seam (`@maralito/observability`) so error capture goes live the moment a
 * `SENTRY_DSN` is set in the environment. With no DSN it initialises to a silent no-op (`capture:
 * 'disabled'`), so this is safe in local/preview and only "turns on" in production via env. This was
 * the one missing piece noted in docs/production-readiness/observability-and-alerting.md (row 4).
 *
 * The import is dynamic and guarded to the Node runtime: instrumentation also executes for the edge
 * runtime, and the middleware edge bundle must not pull server-side modules.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initObservabilityFromEnv } = await import('@maralito/observability');
    initObservabilityFromEnv();
  }
}
