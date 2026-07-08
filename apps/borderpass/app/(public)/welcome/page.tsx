export default function Welcome() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-between px-6 py-10 sm:max-w-xl sm:py-16">
      <section className="flex flex-1 flex-col justify-center">
        <h1 className="font-heading text-primary text-4xl sm:text-6xl">BorderPass</h1>
        <p className="text-on-surface-variant mt-3 text-lg sm:mt-4 sm:text-2xl">
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
