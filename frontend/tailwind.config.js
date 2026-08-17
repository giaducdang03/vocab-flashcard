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
