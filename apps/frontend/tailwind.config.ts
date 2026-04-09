import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './hooks/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        yellow:  '#FFD600',
        ink:     '#1A1A1A',
        surface: '#FFFFFF',
        bg:      '#F7F7F7',
        border:  '#EBEBEB',
        muted:   '#888888',
        dim:     '#BBBBBB',
      },
      borderRadius: {
        xl2: '20px',
        xl3: '28px',
      },
      boxShadow: {
        card:  '0 2px 16px rgba(0,0,0,0.08)',
        sheet: '0 -4px 32px rgba(0,0,0,0.10)',
        pin:   '0 4px 16px rgba(0,0,0,0.20)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
