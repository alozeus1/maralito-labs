export default function Welcome() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-between p-6">
      <section>
        <h1 className="font-heading text-4xl text-primary">BorderPass</h1>
        <p className="mt-3 text-lg text-on-surface-variant">
          Your trusted bridge between the U.S. and Mexico.
        </p>
      </section>
      {/* "Powered by Maralito Labs" is permitted ONLY in welcome/footer/about/settings. */}
      <footer className="py-6 text-center text-xs text-on-surface-variant">
        Powered by Maralito Labs
      </footer>
    </main>
  );
}
