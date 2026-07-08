'use client';
// Phase 8A.2: customer route-group error boundary. Generic copy only — never renders error
// internals (messages may contain backend detail).
export default function CustomerError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-md px-6 py-8 sm:py-12">
      <h1 className="font-heading text-2xl sm:text-3xl">Something went wrong</h1>
      <p className="text-on-surface-variant mt-2">
        We couldn&apos;t load this page. Please try again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="bg-primary text-on-primary hover:bg-primary/90 focus-visible:ring-primary mt-4 w-full rounded-3xl p-3 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:w-auto sm:px-8"
      >
        Try again
      </button>
    </main>
  );
}
