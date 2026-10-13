/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        'instrument-serif': ['"Instrument Serif"', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        eco: {
          ink: '#07090A',
          moss: '#0B0F0E',
          mint: '#6EE7A8',
          lime: '#B6F36B',
        },
      },
      boxShadow: {
        glow: '0 0 80px rgba(110, 231, 168, 0.12)',
      },
      transitionTimingFunction: {
        cinematic: 'cubic-bezier(0.76, 0, 0.24, 1)',
      },
    },
  },
  plugins: [],
}
