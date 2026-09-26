import type { Config } from 'tailwindcss';

// Tokens from website-docs/design.md §4. No web fonts — system mono stack only.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0b0d10',
        panel: '#14171c',
        line: '#232830',
        ink: '#e8ecf1',
        muted: '#8b95a3',
        echo: '#4ade80',
        amber: '#fbbf24',
        danger: '#f87171',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: { DEFAULT: '4px' },
      minHeight: { touch: '48px' },
    },
  },
  plugins: [],
};
export default config;
