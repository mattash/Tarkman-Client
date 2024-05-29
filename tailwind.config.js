/** @type {import('tailwindcss').Config} */
module.exports = {
  purge: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {
      keyframes: {
        flash: {
          '40%, 80%': { backgroundColor: 'transparent' },
          '40%': { backgroundColor: '#556581' }, 
        },
      },
      animation: {
        flash: 'flash 500ms linear 1', // Duration and timing function
      },
    },
  },
  variants: {},
  plugins: [],
}