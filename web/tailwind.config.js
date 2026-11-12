/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        emous: {
          bg: '#0D0D11',
          surface: '#181820',
          pink: '#FF1E8E',
          lime: '#CCFF00',
          yellow: '#FFE600',
          cyan: '#00F0FF',
          purple: '#7928CA',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        sans: ['var(--font-sans)', 'sans-serif'],
      },
      boxShadow: {
        brutal: '4px 4px 0px 0px #000000',
        'brutal-lg': '6px 6px 0px 0px #000000',
        'brutal-pink': '5px 5px 0px 0px #FF1E8E',
        'brutal-lime': '5px 5px 0px 0px #CCFF00',
        'brutal-yellow': '5px 5px 0px 0px #FFE600',
      },
    },
  },
  plugins: [],
};
