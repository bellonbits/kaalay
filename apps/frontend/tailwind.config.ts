import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          green: '#A8D83F',
          purple: '#7B61FF',
          dark: '#0F0F0F',
          card: '#1A1A1A',
          border: '#2A2A2A',
          muted: '#555555',
          gray: '#8E8E9A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
