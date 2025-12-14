/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}", 
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        purple: {
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          900: '#581c87',
        },
        neutral: {
          800: '#262626',
          900: '#171717',
          950: '#0a0a0a',
        }
      },
    },
  },
  plugins: [],
}