/**
 * @maralito/observability — Phase 1: redaction + init structure.
 * Sentry/OTel/PostHog wiring lands alongside the app; full dashboards in Phase 12.
 */
export * from './redact';

export interface ObservabilityConfig {
  sentryDsn?: string;
  otelEndpoint?: string;
  posthogKey?: string;
  posthogHost?: string;
}
export function initObservability(_cfg: ObservabilityConfig): void {
  // no-op in Phase 1.
}
