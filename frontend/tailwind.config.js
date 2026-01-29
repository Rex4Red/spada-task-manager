/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Lexend', 'sans-serif'],
        display: ['Lexend', 'sans-serif'],
        body: ['Lexend', 'sans-serif'],
      },
      colors: {
        "primary": "#137fec",
        "background-light": "#f6f7f8",
        "background-dark": "#101922",
        "card-dark": "#1c2632",
        "upn-green": "#0bda5b",
        "upn-gold": "#fbbf24",
        "input-dark": "#283039",
      }
    },
  },
  darkMode: 'class',
  plugins: [],
}
