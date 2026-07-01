export default function Unauthorized() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="font-heading text-2xl text-on-surface">Access not available</h1>
      <p className="mt-2 text-on-surface-variant">
        You don’t have access to this area. If you think this is a mistake, contact support.
      </p>
    </main>
  );
}
