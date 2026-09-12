/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#f54e00',
        'primary-active': '#d04200',
        'primary-light': '#ff8d5d',
        ink: '#26251e',
        body: '#5a5852',
        muted: '#807d72',
        hairline: '#e6e5e0',
        canvas: '#f7f7f4',
        'surface-card': '#ffffff',
        'surface-strong': '#e6e5e0',
        'on-primary': '#ffffff',
        success: '#1f8a65',
        error: '#cf2d56',
        secondary: '#006c4c',
        'secondary-container': '#91f3c7',
        'on-secondary-container': '#007150',
        tertiary: '#5e5c56',
        surface: '#fef9ee',
        'surface-container': '#f2eee2',
        'canvas-soft': '#fafaf7',
        'hairline-soft': '#efeee8',
        'hairline-strong': '#cfcdc4',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'display-hero': ['48px', { lineHeight: '54px', letterSpacing: '-0.03em', fontWeight: '400' }],
        'headline-lg': ['32px', { lineHeight: '38px', letterSpacing: '-0.015em', fontWeight: '400' }],
        'headline-md': ['22px', { lineHeight: '28px', letterSpacing: '-0.01em', fontWeight: '500' }],
        'title-md': ['18px', { lineHeight: '24px', letterSpacing: '-0.005em', fontWeight: '600' }],
        'title-sm': ['15px', { lineHeight: '22px', fontWeight: '600' }],
        'body-md': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'body-sm': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'caption-uppercase': ['11px', { lineHeight: '16px', letterSpacing: '0.08em', fontWeight: '600' }],
        'code-phonetic': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'code-sm': ['12px', { lineHeight: '16px', fontWeight: '400' }],
      },
      spacing: {
        gutter: '1.25rem',
        margin: '2rem',
        'space-xs': '0.25rem',
        'space-sm': '0.5rem',
        'space-md': '1rem',
        'space-lg': '1.5rem',
        'space-xl': '2rem',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: {
            transform: 'translateY(40px)',
            opacity: '0',
          },
          to: {
            transform: 'translateY(0)',
            opacity: '1',
          },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.2s ease',
        slideUp: 'slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
};
