import Image from 'next/image';
import { ArrowDown } from 'lucide-react';

// Stitch home hero: El Paso ⇄ Ciudad Juárez skyline illustration with a route pill and a
// warm bilingual greeting. `name` is the customer's first name (already non-PII display copy);
// `greetingWord` + `subtitle` are localized.
export function Hero({
  name,
  greetingWord,
  subtitle,
}: {
  name?: string;
  greetingWord: string;
  subtitle: string;
}) {
  const greeting = name ? `${greetingWord} ${name}.` : `${greetingWord}.`;
  return (
    <section className="shadow-level-1 mb-lg md:mb-xl relative h-[340px] overflow-hidden rounded-xl sm:h-[420px] md:h-[480px]">
      <Image
        src="/img/hero-elpaso-juarez.png"
        alt="Illustration of the El Paso and Ciudad Juárez skylines connected by the international bridge at sunset"
        fill
        priority
        sizes="(max-width: 1280px) 100vw, 1280px"
        className="object-cover"
      />
      <div className="from-surface absolute inset-0 z-10 bg-gradient-to-t via-transparent to-transparent" />
      <div className="p-md absolute inset-0 z-20 flex flex-col items-center justify-end text-center">
        <div className="bg-surface/80 shadow-level-1 mb-6 flex items-center gap-3 rounded-full px-5 py-3 backdrop-blur-md sm:gap-4 sm:px-6">
          <span className="font-heading text-primary text-base sm:text-lg">El Paso</span>
          <ArrowDown className="text-outline h-4 w-4" aria-hidden="true" />
          <span className="text-on-surface-variant hidden text-sm sm:inline">
            International Bridge
          </span>
          <ArrowDown className="text-outline hidden h-4 w-4 sm:inline" aria-hidden="true" />
          <span className="font-heading text-primary text-base sm:text-lg">Ciudad Juárez</span>
        </div>
        <h1 className="font-heading text-on-surface md:text-display-lg text-4xl font-bold sm:text-5xl">
          {greeting}
        </h1>
        <p className="font-body text-on-surface-variant text-body-lg mt-2">{subtitle}</p>
      </div>
    </section>
  );
}
