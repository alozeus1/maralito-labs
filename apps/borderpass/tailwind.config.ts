import type { Config } from 'tailwindcss';
import preset from '@maralito/config/tailwind';

export default {
  // Preset is authored in CJS; its fontSize tuples widen to arrays under TS inference, so cast.
  presets: [preset as unknown as Partial<Config>],
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
} satisfies Config;
