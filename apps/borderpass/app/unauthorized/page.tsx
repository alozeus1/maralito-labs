export default function Unauthorized() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="font-heading text-on-surface text-2xl">Access not available</h1>
      <p className="text-on-surface-variant mt-2">
        You don’t have access to this area. If you think this is a mistake, contact support.
      </p>
    </main>
  );
}
