/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // LoomLance Professional Brand Colors
        primary: {
          50: '#f8f9fa',
          100: '#e9ecef',
          200: '#dee2e6',
          300: '#ced4da',
          400: '#adb5bd',
          500: '#2D3E50', // Deep Blue (Primary)
          600: '#243342',
          700: '#1b2833',
          800: '#121d25',
          900: '#0a1216',
        },
        accent: {
          50: '#fef7e6',
          100: '#fdeccd',
          200: '#fbd99b',
          300: '#f9c669',
          400: '#f7b337',
          500: '#F39C12', // Action Orange
          600: '#c27a0e',
          700: '#925c0a',
          800: '#613d07',
          900: '#311e03',
        },
        neutral: {
          50: '#f8f9fa',
          100: '#e9ecef',
          200: '#dee2e6',
          300: '#ced4da',
          400: '#adb5bd',
          500: '#7F8C8D', // Neutral Dark
          600: '#657073',
          700: '#4b5456',
          800: '#313839',
          900: '#181c1c',
        },
        light: {
          50: '#f8f9fa',
          100: '#e9ecef',
          200: '#dee2e6',
          300: '#ced4da',
          400: '#adb5bd',
          500: '#BDC3C7', // Neutral Light
          600: '#97a1a7',
          700: '#717a7d',
          800: '#4b5254',
          900: '#252a2a',
        },
        // Light Mode Colors
        lightMode: {
          background: '#FFFFFF',
          backgroundSecondary: '#F8F9FA',
          textPrimary: '#2D3E50',
          textSecondary: '#7F8C8D',
          border: '#EAECEE',
        },
        // Dark Mode Colors
        darkMode: {
          background: '#1A242F',
          backgroundSecondary: '#2D3E50',
          textPrimary: '#EAECEE',
          textSecondary: '#BDC3C7',
          border: '#41576D',
        },
        // System Colors
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#2ECC71',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        warning: {
          50: '#fefce8',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#F1C40F',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#E74C3C',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        // Legacy colors for compatibility
        secondary: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
