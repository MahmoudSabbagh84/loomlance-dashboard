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
        // LoomLance Design System Colors
        // Primary Brand Colors
        primary: {
          50: '#fef7e6',
          100: '#fdeccd',
          200: '#fbd99b',
          300: '#f9c669',
          400: '#f7b337',
          500: '#F39C12', // Primary Orange
          600: '#E67E22', // Secondary Orange
          700: '#d35400',
          800: '#a04000',
          900: '#7d3200',
        },
        // Text Colors
        text: {
          primary: '#2D3E50', // Primary Dark
          secondary: '#7F8C8D', // Medium Gray
          muted: '#BDC3C7', // Light Gray
        },
        // Background Colors
        bg: {
          primary: '#ffffff', // Pure White
          secondary: '#f8f9fa', // Light Gray
          tertiary: '#e9ecef', // Lighter Gray
          dark: '#2D3E50', // Primary Dark
          'dark-alt': '#34495e', // Secondary Dark
        },
        // Semantic Colors
        success: {
          50: '#e8f5e8',
          100: '#d4edda',
          200: '#c3e6cb',
          300: '#4CAF50', // Success Accent
          400: '#27ae60', // Primary Success
          500: '#27ae60',
          600: '#2e7d32', // Success Text
          700: '#1e5a26',
          800: '#155724',
          900: '#0d3e17',
        },
        warning: {
          50: '#fef7e6',
          100: '#fdeccd',
          200: '#fbd99b',
          300: '#f9c669',
          400: '#f7b337',
          500: '#f39c12', // Warning Orange
          600: '#e67e22',
          700: '#d35400',
          800: '#a04000',
          900: '#7d3200',
        },
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#e74c3c', // Error Red
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        // Light Mode Colors (using new design system)
        lightMode: {
          background: '#ffffff',
          backgroundSecondary: '#f8f9fa',
          textPrimary: '#2D3E50',
          textSecondary: '#7F8C8D',
          border: '#BDC3C7',
        },
        // Dark Mode Colors
        darkMode: {
          background: '#1A242F',
          backgroundSecondary: '#2D3E50',
          textPrimary: '#EAECEE',
          textSecondary: '#BDC3C7',
          border: '#41576D',
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
        },
        // Neutral grays for UI elements
        neutral: {
          50: '#f8f9fa',
          100: '#e9ecef',
          200: '#dee2e6',
          300: '#ced4da',
          400: '#adb5bd',
          500: '#7F8C8D',
          600: '#657073',
          700: '#4b5456',
          800: '#313839',
          900: '#181c1c',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'brand': '0 4px 15px rgba(243, 156, 18, 0.3)',
        'brand-hover': '0 8px 25px rgba(243, 156, 18, 0.4)',
      },
    },
  },
  plugins: [],
}
