import type { Config } from 'tailwindcss'

export default {
  content: ['./src/renderer/**/*.{html,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'monospace'],
        display: ['Geist', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
} satisfies Config
