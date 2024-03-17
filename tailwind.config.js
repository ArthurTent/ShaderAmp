module.exports = {
  purge: ["./src/**/*.{js,jsx,ts,tsx}", "./dist/*.html"],
  content: ["./src/**/*.{html,js,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [require('tailwind-scrollbar')],
}