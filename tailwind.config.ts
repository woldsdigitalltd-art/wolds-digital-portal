import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      colors: {
        brand: {
          50:  '#fdf8ee',
          100: '#faefd0',
          200: '#f5dc9d',
          400: '#e8a830',
          500: '#d4901a',
          600: '#b97510',
          700: '#8f590d',
          800: '#6b4110',
          900: '#4a2d0c',
        },
      },
    },
  },
  plugins: [],
}

export default config
