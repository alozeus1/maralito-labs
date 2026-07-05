'use client';
// Phase 8A.2: customer route-group error boundary. Generic copy only — never renders error
// internals (messages may contain backend detail).
export default function CustomerError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="font-heading text-2xl">Something went wrong</h1>
      <p className="text-on-surface-variant mt-2">
        We couldn&apos;t load this page. Please try again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="bg-primary text-on-primary mt-4 w-full rounded-3xl p-3 font-medium"
      >
        Try again
      </button>
    </main>
  );
}
