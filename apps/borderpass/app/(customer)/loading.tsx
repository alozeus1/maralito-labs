// Phase 8A.2: branded loading state for the customer route group (mobile-safe skeleton).
export default function CustomerLoading() {
  return (
    <main
      aria-busy="true"
      className="mx-auto w-full max-w-md px-6 py-8 sm:max-w-2xl sm:px-8 sm:py-10 lg:max-w-5xl"
    >
      <div className="bg-surface-variant h-7 w-40 animate-pulse rounded-md motion-reduce:animate-none" />
      <div className="bg-surface-variant mt-4 h-4 w-full animate-pulse rounded-md motion-reduce:animate-none" />
      <div className="bg-surface-variant mt-2 h-4 w-3/4 animate-pulse rounded-md motion-reduce:animate-none" />
      <div className="border-outline mt-6 h-24 animate-pulse rounded-lg border motion-reduce:animate-none" />
      <p className="sr-only">Loading…</p>
    </main>
  );
}
