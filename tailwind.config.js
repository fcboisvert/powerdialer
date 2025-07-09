// tailwind.config.js
import defaultTheme from 'tailwindcss/defaultTheme';

export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}',   // keep existing paths
  ],
  theme: {
    extend: {
      colors: {
        'texion-orange': {
          DEFAULT: '#E74F27',   // ⇦ main brand orange
          50:  '#FFF4F1',
          100: '#FFE9E4',
          200: '#FFD1C8',
          300: '#FFA999',
          400: '#FF7C66',
          500: '#E74F27',
          600: '#D5421B',
          700: '#B9330F',
          800: '#972909',
          900: '#7F2006',
        },
        'texion-black':  '#1E1E1E',
        'texion-gray':   '#6B7280',
      },
      fontFamily: {
        texion: ['Inter', ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
};
