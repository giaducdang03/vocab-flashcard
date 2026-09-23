/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#a83300',
        'primary-active': '#d04200',
        'primary-light': '#ffb59d',
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
        'learned-surface': '#ebf6f1',
        'muted-soft': '#a09c92',
        'secondary-fixed': '#94f6ca',
        'primary-fixed': '#ffdbd0',
        'surface-container-low': '#f8f3e8',
        'surface-container-high': '#ece8dd',
        'on-surface': '#1d1c15',
        'on-surface-variant': '#5c4038',
        'on-primary-fixed': '#390b00',
        'on-secondary-fixed': '#002115',
        'error-container': '#ffdad6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      // Sizes are CSS custom properties (defined in src/index.css :root) so every
      // text-* utility can shrink a notch on mobile from one place, without
      // touching each component.
      fontSize: {
        'display-hero': ['var(--fs-display-hero)', { lineHeight: 'var(--lh-display-hero)', letterSpacing: '-0.03em', fontWeight: '400' }],
        'headline-lg': ['var(--fs-headline-lg)', { lineHeight: 'var(--lh-headline-lg)', letterSpacing: '-0.015em', fontWeight: '400' }],
        'headline-md': ['var(--fs-headline-md)', { lineHeight: 'var(--lh-headline-md)', letterSpacing: '-0.01em', fontWeight: '500' }],
        'title-md': ['var(--fs-title-md)', { lineHeight: 'var(--lh-title-md)', letterSpacing: '-0.005em', fontWeight: '600' }],
        'title-sm': ['var(--fs-title-sm)', { lineHeight: 'var(--lh-title-sm)', fontWeight: '600' }],
        'body-md': ['var(--fs-body-md)', { lineHeight: 'var(--lh-body-md)', fontWeight: '400' }],
        'body-sm': ['var(--fs-body-sm)', { lineHeight: 'var(--lh-body-sm)', fontWeight: '400' }],
        'caption-uppercase': ['var(--fs-caption-uppercase)', { lineHeight: 'var(--lh-caption-uppercase)', letterSpacing: '0.08em', fontWeight: '600' }],
        'code-phonetic': ['var(--fs-code-phonetic)', { lineHeight: 'var(--lh-code-phonetic)', fontWeight: '400' }],
        'code-sm': ['var(--fs-code-sm)', { lineHeight: 'var(--lh-code-sm)', fontWeight: '400' }],
        button: ['var(--fs-button)', { lineHeight: 'var(--lh-button)', fontWeight: '500' }],
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
