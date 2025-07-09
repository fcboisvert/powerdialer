// tailwind.config.js
import defaultTheme from 'tailwindcss/defaultTheme';

export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}',   // make sure paths match your repo
  ],
  theme: {
    extend: {
      colors: {
        'texion-orange': {
          DEFAULT: '#E74F27',
          600: '#D5421B',
          700: '#B9330F',
        },
        'texion-black': '#1E1E1E',
        'texion-gray' : '#6B7280',
      },
      fontFamily: {
        texion: ['Inter', ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
};
