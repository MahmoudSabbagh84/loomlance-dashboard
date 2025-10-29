// LoomLance Design System - Theme Classes
// This file contains all theme-related classes and utilities based on the LoomLance Design System

export const themeClasses = {
  // Background colors
  background: {
    primary: 'bg-white dark:bg-darkMode-background',
    secondary: 'bg-bg-secondary dark:bg-darkMode-backgroundSecondary',
    tertiary: 'bg-bg-tertiary dark:bg-darkMode-background',
    card: 'bg-white dark:bg-darkMode-backgroundSecondary',
    hover: 'hover:bg-bg-secondary dark:hover:bg-darkMode-background',
    hoverLight: 'hover:bg-neutral-100 dark:hover:bg-darkMode-background',
    dark: 'bg-bg-dark dark:bg-bg-dark-alt',
  },

  // Text colors
  text: {
    primary: 'text-text-primary dark:text-darkMode-textPrimary',
    secondary: 'text-text-secondary dark:text-darkMode-textSecondary',
    muted: 'text-text-muted dark:text-neutral-400',
    light: 'text-neutral-400 dark:text-neutral-500',
    inverse: 'text-white dark:text-darkMode-textPrimary',
    brand: 'text-primary-500 dark:text-primary-400',
    brandHover: 'text-primary-600 dark:text-primary-300',
  },

  // Border colors
  border: {
    primary: 'border-lightMode-border dark:border-darkMode-border',
    secondary: 'border-neutral-300 dark:border-neutral-600',
    accent: 'border-primary-200 dark:border-primary-800',
    brand: 'border-primary-500 dark:border-primary-400',
  },

  // Button styles
  button: {
    primary: 'bg-primary-500 text-white hover:bg-primary-600 shadow-brand hover:shadow-brand-hover transition-all duration-300 hover:-translate-y-0.5 dark:bg-primary-500 dark:text-white dark:hover:bg-primary-600',
    secondary: 'bg-transparent text-text-primary border-2 border-text-muted hover:border-primary-500 hover:text-primary-500 transition-all duration-300 hover:-translate-y-0.5 dark:bg-transparent dark:text-darkMode-textPrimary dark:border-neutral-600 dark:hover:border-primary-400 dark:hover:text-primary-400',
    ghost: 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-all duration-300 dark:text-darkMode-textSecondary dark:hover:text-darkMode-textPrimary dark:hover:bg-darkMode-background',
    danger: 'bg-error-500 text-white hover:bg-error-600 transition-all duration-300 hover:-translate-y-0.5 dark:bg-error-500 dark:text-white dark:hover:bg-error-600',
    success: 'bg-success-500 text-white hover:bg-success-600 transition-all duration-300 hover:-translate-y-0.5 dark:bg-success-500 dark:text-white dark:hover:bg-success-600',
  },

  // Input styles
  input: 'border-2 border-text-muted bg-white text-text-primary placeholder-text-secondary focus:border-primary-500 focus:ring-4 focus:ring-primary-100 transition-all duration-300 dark:border-darkMode-border dark:bg-darkMode-backgroundSecondary dark:text-darkMode-textPrimary dark:placeholder-darkMode-textSecondary dark:focus:border-primary-400 dark:focus:ring-primary-900',

  // Card styles
  card: 'bg-white border border-lightMode-border rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 dark:bg-darkMode-backgroundSecondary dark:border-darkMode-border',
  cardFeatured: 'bg-white border-3 border-primary-500 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 dark:bg-darkMode-backgroundSecondary dark:border-primary-400',

  // Navigation styles
  nav: {
    item: 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-all duration-300 dark:text-darkMode-textSecondary dark:hover:text-darkMode-textPrimary dark:hover:bg-darkMode-background',
    itemActive: 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300',
  },

  // Status colors
  status: {
    success: 'bg-success-50 text-success-600 dark:bg-success-900 dark:text-success-300',
    warning: 'bg-warning-50 text-warning-600 dark:bg-warning-900 dark:text-warning-300',
    error: 'bg-error-50 text-error-600 dark:bg-error-900 dark:text-error-300',
    info: 'bg-primary-50 text-primary-600 dark:bg-primary-900 dark:text-primary-300',
    pending: 'bg-warning-50 text-warning-600 dark:bg-warning-900 dark:text-warning-300',
    paid: 'bg-success-50 text-success-600 dark:bg-success-900 dark:text-success-300',
    active: 'bg-success-50 text-success-600 dark:bg-success-900 dark:text-success-300',
    completed: 'bg-primary-50 text-primary-600 dark:bg-primary-900 dark:text-primary-300',
    draft: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-300',
    expired: 'bg-error-50 text-error-600 dark:bg-error-900 dark:text-error-300',
  },

  // Icon colors
  icon: {
    primary: 'text-text-secondary dark:text-darkMode-textSecondary',
    secondary: 'text-neutral-500 dark:text-neutral-400',
    accent: 'text-primary-500 dark:text-primary-400',
    success: 'text-success-500 dark:text-success-400',
    warning: 'text-warning-500 dark:text-warning-400',
    error: 'text-error-500 dark:text-error-400',
  },

  // Quick action cards
  quickAction: {
    container: 'flex items-center p-4 border border-lightMode-border rounded-xl hover:bg-bg-secondary transition-all duration-300 hover:shadow-md dark:border-darkMode-border dark:hover:bg-darkMode-background',
    text: 'text-sm font-medium text-text-primary dark:text-darkMode-textPrimary',
    subtitle: 'text-xs text-text-secondary dark:text-darkMode-textSecondary',
  },

  // Dropdown styles
  dropdown: {
    container: 'absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg py-1 z-50 border border-lightMode-border dark:bg-darkMode-backgroundSecondary dark:border-darkMode-border',
    item: 'flex items-center w-full px-4 py-2 text-sm text-text-primary hover:bg-bg-secondary transition-colors dark:text-darkMode-textPrimary dark:hover:bg-darkMode-background',
    header: 'px-4 py-2 border-b border-lightMode-border dark:border-darkMode-border',
  },

  // Sidebar styles
  sidebar: {
    container: 'bg-white dark:bg-darkMode-backgroundSecondary',
    logo: 'text-text-primary dark:text-darkMode-textPrimary',
    navItem: 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-all duration-300 dark:text-darkMode-textSecondary dark:hover:bg-darkMode-background dark:hover:text-darkMode-textPrimary',
    navItemActive: 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300',
  },

  // Table styles
  table: {
    header: 'bg-bg-secondary dark:bg-darkMode-backgroundSecondary',
    cell: 'text-text-primary dark:text-darkMode-textPrimary',
    cellMuted: 'text-text-secondary dark:text-darkMode-textSecondary',
    row: 'bg-white hover:bg-bg-secondary dark:bg-darkMode-backgroundSecondary dark:hover:bg-darkMode-background',
    rowHover: 'hover:bg-bg-secondary dark:hover:bg-darkMode-background',
  },

  // Modal styles
  modal: {
    overlay: 'fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-darkMode-background dark:bg-opacity-75',
    container: 'bg-white rounded-2xl shadow-xl dark:bg-darkMode-backgroundSecondary',
    header: 'bg-white dark:bg-darkMode-backgroundSecondary',
    body: 'bg-white dark:bg-darkMode-backgroundSecondary',
    footer: 'bg-bg-secondary dark:bg-darkMode-background',
  },

  // Form styles
  form: {
    label: 'block text-sm font-medium text-text-primary dark:text-darkMode-textPrimary',
    help: 'text-sm text-text-secondary dark:text-darkMode-textSecondary',
    error: 'text-sm text-error-500 dark:text-error-400',
    required: 'text-error-500 dark:text-error-400',
  },

  // Gradient backgrounds
  gradient: {
    light: 'bg-gradient-to-br from-bg-secondary to-bg-tertiary',
    dark: 'bg-gradient-to-br from-bg-dark to-bg-dark-alt',
    brand: 'bg-gradient-to-r from-primary-500 to-primary-600',
    brandExtended: 'bg-gradient-to-r from-primary-500 via-primary-600 to-primary-500',
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
