// Optimized theme system with better performance
import { useMemo } from 'react'

// Memoized theme classes to prevent recreation
const createThemeClasses = () => ({
  // Layout
  layout: {
    container: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8',
    section: 'py-6',
    grid: {
      cols1: 'grid-cols-1',
      cols2: 'grid-cols-1 md:grid-cols-2',
      cols3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
      cols4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
    }
  },

  // Cards
  card: 'bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 rounded-lg',
  cardHeader: 'px-6 py-4 border-b border-gray-200 dark:border-gray-700',
  cardBody: 'px-6 py-4',
  cardFooter: 'px-6 py-4 border-t border-gray-200 dark:border-gray-700',

  // Buttons - Optimized with consistent sizing
  button: {
    base: 'inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none px-6 py-3 whitespace-normal break-words min-h-[48px]',
    primary: 'bg-primary-500 text-white hover:bg-primary-600 focus:ring-primary-500 dark:bg-primary-600 dark:hover:bg-primary-700',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600',
    danger: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500 dark:bg-red-600 dark:hover:bg-red-700',
    success: 'bg-green-500 text-white hover:bg-green-600 focus:ring-green-500 dark:bg-green-600 dark:hover:bg-green-700',
    warning: 'bg-yellow-500 text-white hover:bg-yellow-600 focus:ring-yellow-500 dark:bg-yellow-600 dark:hover:bg-yellow-700',
    ghost: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700',
    link: 'text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 underline-offset-4 hover:underline'
  },

  // Forms
  form: {
    label: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1',
    input: 'block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white',
    textarea: 'block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white',
    select: 'block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white',
    checkbox: 'h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600',
    radio: 'h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:bg-gray-700 dark:border-gray-600',
    error: 'text-red-600 text-sm mt-1 dark:text-red-400',
    help: 'text-gray-500 text-sm mt-1 dark:text-gray-400'
  },

  // Tables - Optimized without animations
  table: {
    container: 'overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg',
    table: 'min-w-full divide-y divide-gray-300 dark:divide-gray-600',
    header: 'bg-gray-50 dark:bg-gray-700',
    headerCell: 'px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider',
    body: 'bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600',
    row: 'bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700',
    cell: 'px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white',
    cellRight: 'px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right'
  },

  // Modals
  modal: {
    overlay: 'fixed inset-0 z-50 overflow-y-auto',
    backdrop: 'fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity',
    container: 'inline-block transform overflow-hidden rounded-2xl bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl sm:align-middle dark:bg-gray-800',
    header: 'px-6 pt-6 pb-4',
    body: 'px-6 py-4',
    footer: 'px-6 py-4 bg-gray-50 dark:bg-gray-700 flex justify-end space-x-3'
  },

  // Navigation
  nav: {
    item: 'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
    itemActive: 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300',
    itemInactive: 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700'
  },

  // Status indicators
  status: {
    badge: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
    paid: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    overdue: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    active: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    expired: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
  },

  // Dropdowns
  dropdown: {
    container: 'relative inline-block text-left',
    button: 'inline-flex items-center justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:bg-gray-600',
    panel: 'origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-10 dark:bg-gray-800 dark:ring-gray-700',
    item: 'block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
  },

  // Typography
  text: {
    primary: 'text-gray-900 dark:text-white',
    secondary: 'text-gray-600 dark:text-gray-400',
    muted: 'text-gray-500 dark:text-gray-500',
    success: 'text-green-600 dark:text-green-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    error: 'text-red-600 dark:text-red-400',
    info: 'text-blue-600 dark:text-blue-400'
  },

  // Spacing utilities
  spacing: {
    xs: 'space-y-1',
    sm: 'space-y-2',
    md: 'space-y-4',
    lg: 'space-y-6',
    xl: 'space-y-8'
  }
})

// Memoized theme classes instance
let memoizedThemeClasses = null

export const getThemeClasses = () => {
  if (!memoizedThemeClasses) {
    memoizedThemeClasses = createThemeClasses()
  }
  return memoizedThemeClasses
}

// Optimized combine function
export const combineThemeClasses = (baseClasses, themeClasses) => {
  if (!themeClasses) return baseClasses
  if (typeof themeClasses === 'string') return `${baseClasses} ${themeClasses}`
  if (Array.isArray(themeClasses)) return `${baseClasses} ${themeClasses.join(' ')}`
  return baseClasses
}

// Hook for optimized theme classes
export const useThemeClasses = () => {
  return useMemo(() => getThemeClasses(), [])
}

// Export the theme classes
export const themeClasses = getThemeClasses()
