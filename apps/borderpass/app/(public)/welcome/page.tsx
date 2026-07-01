export default function Welcome() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-between p-6">
      <section>
        <h1 className="font-heading text-primary text-4xl">BorderPass</h1>
        <p className="text-on-surface-variant mt-3 text-lg">
          Your trusted bridge between the U.S. and Mexico.
        </p>
      </section>
      {/* "Powered by Maralito Labs" is permitted ONLY in welcome/footer/about/settings. */}
      <footer className="text-on-surface-variant py-6 text-center text-xs">
        Powered by Maralito Labs
      </footer>
    </main>
  );
}
