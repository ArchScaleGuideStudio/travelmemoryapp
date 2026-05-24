/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Light, clean palette — see styles/tokens.ts for the source of truth
        paper:      '#F6F3EC',
        paperDeep:  '#F0ECE0',
        paperEdge:  '#E5E0D2',
        panel:      '#FFFFFF',
        ink:        '#1F1E1A',
        inkSoft:    '#6B6862',
        inkFaint:   '#A09C92',
        accent:     '#B85C2E',
        accentSoft: '#EBD3C4',
        accentDeep: '#8C3F1A',
        danger:     '#C44A1F',
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        serif: ['Fraunces', 'Georgia', 'serif'],
        mono: ['DM Mono', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        tightish: '-0.01em',
        wider2: '0.2em',
      },
    },
  },
  plugins: [],
}
