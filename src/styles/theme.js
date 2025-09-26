// Consolidated theme system for LoomLance Dashboard
// This file contains all theme-related classes and utilities

export const themeClasses = {
  // Background colors
  background: {
    primary: 'bg-white dark:bg-darkMode-background',
    secondary: 'bg-lightMode-backgroundSecondary dark:bg-darkMode-backgroundSecondary',
    card: 'bg-white dark:bg-darkMode-backgroundSecondary',
    hover: 'hover:bg-lightMode-backgroundSecondary dark:hover:bg-darkMode-background',
    hoverLight: 'hover:bg-gray-100 dark:hover:bg-darkMode-background',
  },

  // Text colors
  text: {
    primary: 'text-lightMode-textPrimary dark:text-darkMode-textPrimary',
    secondary: 'text-lightMode-textSecondary dark:text-darkMode-textSecondary',
    muted: 'text-neutral-500 dark:text-light-500',
    light: 'text-neutral-400 dark:text-light-400',
    inverse: 'text-white dark:text-darkMode-textPrimary',
  },

  // Border colors
  border: {
    primary: 'border-lightMode-border dark:border-darkMode-border',
    secondary: 'border-neutral-300 dark:border-neutral-600',
    accent: 'border-primary-200 dark:border-primary-800',
  },

  // Button styles
  button: {
    primary: 'bg-primary-500 text-white hover:bg-primary-600 dark:bg-primary-500 dark:text-white dark:hover:bg-primary-600',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600',
    accent: 'bg-accent-500 text-white hover:bg-accent-600 dark:bg-accent-500 dark:text-white dark:hover:bg-accent-600',
    ghost: 'text-lightMode-textSecondary hover:text-lightMode-textPrimary hover:bg-lightMode-backgroundSecondary dark:text-darkMode-textSecondary dark:hover:text-darkMode-textPrimary dark:hover:bg-darkMode-background',
    danger: 'bg-error-500 text-white hover:bg-error-600 dark:bg-error-500 dark:text-white dark:hover:bg-error-600',
  },

  // Input styles
  input: 'border-lightMode-border bg-white text-lightMode-textPrimary placeholder-lightMode-textSecondary focus:border-primary-500 focus:ring-primary-500 dark:border-darkMode-border dark:bg-darkMode-backgroundSecondary dark:text-darkMode-textPrimary dark:placeholder-darkMode-textSecondary dark:focus:border-primary-400 dark:focus:ring-primary-400',

  // Card styles
  card: 'bg-white border border-lightMode-border shadow-sm dark:bg-darkMode-backgroundSecondary dark:border-darkMode-border',

  // Navigation styles
  nav: {
    item: 'text-lightMode-textSecondary hover:text-lightMode-textPrimary hover:bg-lightMode-backgroundSecondary dark:text-darkMode-textSecondary dark:hover:text-darkMode-textPrimary dark:hover:bg-darkMode-background',
    itemActive: 'bg-primary-100 text-primary-500 dark:bg-primary-800 dark:text-primary-300',
  },

  // Status colors
  status: {
    success: 'bg-success-100 text-success-800 dark:bg-success-900 dark:text-success-300',
    warning: 'bg-warning-100 text-warning-800 dark:bg-warning-900 dark:text-warning-300',
    error: 'bg-error-100 text-error-800 dark:bg-error-900 dark:text-error-300',
    info: 'bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-300',
    pending: 'bg-warning-100 text-warning-800 dark:bg-warning-900 dark:text-warning-300',
    paid: 'bg-success-100 text-success-800 dark:bg-success-900 dark:text-success-300',
    active: 'bg-success-100 text-success-800 dark:bg-success-900 dark:text-success-300',
    completed: 'bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-300',
    draft: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-300',
    expired: 'bg-error-100 text-error-800 dark:bg-error-900 dark:text-error-300',
  },

  // Icon colors
  icon: {
    primary: 'text-lightMode-textSecondary dark:text-darkMode-textSecondary',
    secondary: 'text-neutral-500 dark:text-neutral-400',
    accent: 'text-primary-500 dark:text-primary-400',
    success: 'text-success-500 dark:text-success-400',
    warning: 'text-warning-500 dark:text-warning-400',
    error: 'text-error-500 dark:text-error-400',
  },

  // Quick action cards
  quickAction: {
    container: 'flex items-center p-4 border border-lightMode-border rounded-lg hover:bg-lightMode-backgroundSecondary transition-colors dark:border-darkMode-border dark:hover:bg-darkMode-background',
    text: 'text-sm font-medium text-lightMode-textPrimary dark:text-darkMode-textPrimary',
    subtitle: 'text-xs text-lightMode-textSecondary dark:text-darkMode-textSecondary',
  },

  // Dropdown styles
  dropdown: {
    container: 'absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-lightMode-border dark:bg-darkMode-backgroundSecondary dark:border-darkMode-border',
    item: 'flex items-center w-full px-4 py-2 text-sm text-lightMode-textPrimary hover:bg-lightMode-backgroundSecondary dark:text-darkMode-textPrimary dark:hover:bg-darkMode-background',
    header: 'px-4 py-2 border-b border-lightMode-border dark:border-darkMode-border',
  },

  // Sidebar styles
  sidebar: {
    container: 'bg-white dark:bg-darkMode-backgroundSecondary',
    logo: 'text-lightMode-textPrimary dark:text-darkMode-textPrimary',
    navItem: 'text-lightMode-textSecondary hover:bg-lightMode-backgroundSecondary hover:text-lightMode-textPrimary dark:text-darkMode-textSecondary dark:hover:bg-darkMode-background dark:hover:text-darkMode-textPrimary',
    navItemActive: 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300',
  },

  // Table styles
  table: {
    header: 'bg-lightMode-backgroundSecondary dark:bg-darkMode-backgroundSecondary',
    cell: 'text-lightMode-textPrimary dark:text-darkMode-textPrimary',
    cellMuted: 'text-lightMode-textSecondary dark:text-darkMode-textSecondary',
    row: 'bg-white hover:bg-lightMode-backgroundSecondary dark:bg-darkMode-backgroundSecondary dark:hover:bg-darkMode-background',
    rowHover: 'hover:bg-lightMode-backgroundSecondary dark:hover:bg-darkMode-background',
  },

  // Modal styles
  modal: {
    overlay: 'fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-darkMode-background dark:bg-opacity-75',
    container: 'bg-white dark:bg-darkMode-backgroundSecondary',
    header: 'bg-white dark:bg-darkMode-backgroundSecondary',
    body: 'bg-white dark:bg-darkMode-backgroundSecondary',
    footer: 'bg-lightMode-backgroundSecondary dark:bg-darkMode-background',
  },

  // Form styles
  form: {
    label: 'block text-sm font-medium text-lightMode-textPrimary dark:text-darkMode-textPrimary',
    help: 'text-sm text-lightMode-textSecondary dark:text-darkMode-textSecondary',
    error: 'text-sm text-error-600 dark:text-error-400',
    required: 'text-error-500 dark:text-error-400',
  },
}

// Utility function to combine theme classes
export const combineThemeClasses = (...classes) => {
  return classes.filter(Boolean).join(' ')
}

// Theme-aware component classes
export const themeComponents = {
  // Page containers
  pageContainer: combineThemeClasses(themeClasses.background.primary),
  
  // Cards
  card: combineThemeClasses(themeClasses.card),
  
  // Buttons
  btnPrimary: combineThemeClasses(themeClasses.button.primary),
  btnSecondary: combineThemeClasses(themeClasses.button.secondary),
  btnGhost: combineThemeClasses(themeClasses.button.ghost),
  
  // Inputs
  input: combineThemeClasses(themeClasses.input),
  
  // Navigation
  navItem: combineThemeClasses(themeClasses.nav.item),
  navItemActive: combineThemeClasses(themeClasses.nav.itemActive),
  
  // Text
  textPrimary: combineThemeClasses(themeClasses.text.primary),
  textSecondary: combineThemeClasses(themeClasses.text.secondary),
  textMuted: combineThemeClasses(themeClasses.text.muted),
  
  // Quick actions
  quickAction: combineThemeClasses(themeClasses.quickAction.container),
  quickActionText: combineThemeClasses(themeClasses.quickAction.text),
  quickActionSubtitle: combineThemeClasses(themeClasses.quickAction.subtitle),
}
