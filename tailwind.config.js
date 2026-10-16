/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        fairway: {
          green: '#2E8B57',
          dark: '#1E5E3A',
          deep: '#143F27',
          cream: '#E9F5EC',
          light: '#F5FAF6',
          sand: '#F4E4C1',
          sandDark: '#DFC690',
          gold: '#D4AF37',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
