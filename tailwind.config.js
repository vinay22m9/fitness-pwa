/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg:        'rgb(var(--bg) / <alpha-value>)',
        surface:   'rgb(var(--surface) / <alpha-value>)',
        elevated:  'rgb(var(--elevated) / <alpha-value>)',
        border:    'rgb(var(--border) / <alpha-value>)',
        primary:   'rgb(var(--primary) / <alpha-value>)',
        accent:    'rgb(var(--accent) / <alpha-value>)',
        electric:  'rgb(var(--electric) / <alpha-value>)',
        warning:   'rgb(var(--warning) / <alpha-value>)',
        danger:    'rgb(var(--danger) / <alpha-value>)',
        success:   'rgb(var(--success) / <alpha-value>)',
        text:      'rgb(var(--text) / <alpha-value>)',
        muted:     'rgb(var(--muted) / <alpha-value>)',
        subtle:    'rgb(var(--subtle) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.5rem',
        '4xl': '1.75rem',
      },
      animation: {
        'fade-in':   'fadeIn 0.3s ease-out',
        'slide-up':  'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'pop':       'pop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:    { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp:   { '0%': { transform: 'translateY(10px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        pop:       { '0%': { transform: 'scale(0.95)' }, '60%': { transform: 'scale(1.02)' }, '100%': { transform: 'scale(1)' } },
        pulseSoft: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.65' } },
      },
    },
  },
  plugins: [],
};
