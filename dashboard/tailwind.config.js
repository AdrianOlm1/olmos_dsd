/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#06b6d4',
          dark: '#0891b2',
          light: '#22d3ee',
          50: '#ecfeff',
          100: '#cffafe',
        },
        // Keep legacy 'dark' tokens so existing classnames still resolve
        dark: {
          DEFAULT: '#0f172a',
          card: '#1e293b',
          border: '#334155',
          input: '#0f172a',
        },
        surface: {
          DEFAULT: '#0f172a',
          card: '#1e293b',
          raised: '#334155',
        },
        success: {
          DEFAULT: '#22c55e',
          bg: 'rgba(34,197,94,0.1)',
        },
        warning: {
          DEFAULT: '#f59e0b',
          bg: 'rgba(245,158,11,0.1)',
        },
        danger: {
          DEFAULT: '#ef4444',
          bg: 'rgba(239,68,68,0.1)',
        },
        info: {
          DEFAULT: '#3b82f6',
          bg: 'rgba(59,130,246,0.1)',
        },
        muted: '#94a3b8',
        subtle: '#64748b',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.4)',
        elevated: '0 4px 12px rgb(0 0 0 / 0.5)',
        glow: '0 0 24px rgba(6,182,212,0.18)',
      },
      animation: {
        'fade-in': 'fadeIn 0.18s ease-out',
        'slide-down': 'slideDown 0.22s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideDown: { from: { opacity: '0', transform: 'translateY(-6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};
