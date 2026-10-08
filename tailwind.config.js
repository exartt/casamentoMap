/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/client/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f3f6f1',
          100: '#e3eadf',
          200: '#c7d6bf',
          300: '#a3bb97',
          400: '#7d9c6f',
          500: '#5f8052',
          600: '#4a6640',
          700: '#3b5134',
          800: '#31422c',
          900: '#293726',
        },
      },
    },
  },
  plugins: [],
};
