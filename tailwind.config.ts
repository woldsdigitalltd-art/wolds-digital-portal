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
        // Deep navy — matches the Wolds Digital logo
        navy: {
          50:  '#f1f5fb',
          100: '#dde7f2',
          200: '#bcd0e7',
          300: '#8eafd3',
          400: '#5d88ba',
          500: '#3c6aa1',
          600: '#2d5388',
          700: '#254370',
          800: '#1c335a',
          900: '#0b2545',
          950: '#061731',
        },
        // Sage / olive green — accent matching the marketing site
        brand: {
          50:  '#f4f8ec',
          100: '#e6efd6',
          200: '#cee0b0',
          300: '#aecc80',
          400: '#8fb656',
          500: '#7ca653',
          600: '#5f8240',
          700: '#4a6633',
          800: '#3c532c',
          900: '#324527',
        },
      },
      boxShadow: {
        soft: '0 1px 2px rgba(11, 37, 69, 0.04), 0 4px 16px rgba(11, 37, 69, 0.04)',
      },
      backgroundImage: {
        'page-gradient':
          'radial-gradient(1200px 600px at 0% 0%, #ecf3e3 0%, transparent 60%),' +
          'radial-gradient(900px 500px at 100% 0%, #f3f6fb 0%, transparent 60%),' +
          'linear-gradient(180deg, #ffffff 0%, #f7faf3 100%)',
      },
    },
  },
  plugins: [],
}

export default config
