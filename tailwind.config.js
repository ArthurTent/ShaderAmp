module.exports = {
  theme: {
    extend: {
      boxShadow: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      },
    },
  },
  plugins: [require('tailwind-scrollbar')],
  darkMode: 'class',
}