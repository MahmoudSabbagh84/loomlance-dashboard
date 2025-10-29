import React, { memo, useMemo, useCallback } from 'react'
import { useTheme } from '../context/ThemeContext'
import { combineThemeClasses, themeClasses } from '../styles/theme'

// Memoized Status Badge Component
export const StatusBadge = memo(({ status, className = '' }) => {
  const getStatusColor = useCallback((status) => {
    switch (status) {
      case 'paid':
      case 'completed':
      case 'active':
        return 'bg-success-50 text-success-600 dark:bg-success-900 dark:text-success-300'
      case 'pending':
        return 'bg-warning-50 text-warning-600 dark:bg-warning-900 dark:text-warning-300'
      case 'overdue':
      case 'expired':
      case 'cancelled':
        return 'bg-error-50 text-error-600 dark:bg-error-900 dark:text-error-300'
      default:
        return 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-300'
    }
  }, [])

  const statusColor = useMemo(() => getStatusColor(status), [status, getStatusColor])

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor} ${className}`}>
      {status}
    </span>
  )
})

StatusBadge.displayName = 'StatusBadge'

// Memoized Currency Display Component
export const CurrencyDisplay = memo(({ amount, className = '' }) => {
  const formattedAmount = useMemo(() => {
    return (parseFloat(amount) || 0).toFixed(2)
  }, [amount])

  return (
    <span className={className}>
      ${formattedAmount}
    </span>
  )
})

CurrencyDisplay.displayName = 'CurrencyDisplay'

// Memoized Date Display Component
export const DateDisplay = memo(({ date, format = 'MMM dd, yyyy', className = '' }) => {
  const { format: formatDate } = require('date-fns')
  
  const formattedDate = useMemo(() => {
    if (!date) return 'N/A'
    try {
      return formatDate(new Date(date), format)
    } catch {
      return 'Invalid Date'
    }
  }, [date, format, formatDate])

  return (
    <span className={className}>
      {formattedDate}
    </span>
  )
})

DateDisplay.displayName = 'DateDisplay'

// Memoized Action Button Component
export const ActionButton = memo(({ 
  onClick, 
  icon: Icon, 
  title, 
  className = '', 
  variant = 'default',
  size = 'sm' 
}) => {
  const { theme } = useTheme()
  
  const buttonClasses = useMemo(() => {
    const baseClasses = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2'
    
    const variantClasses = {
      default: 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white',
      primary: 'text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300',
      danger: 'text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300',
      success: 'text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300'
    }
    
    const sizeClasses = {
      sm: 'h-8 w-8',
      md: 'h-10 w-10',
      lg: 'h-12 w-12'
    }
    
    return `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`
  }, [variant, size, className])

  return (
    <button
      onClick={onClick}
      className={buttonClasses}
      title={title}
      type="button"
    >
      <Icon className="h-4 w-4" />
    </button>
  )
})

ActionButton.displayName = 'ActionButton'

// Memoized Table Row Component
export const TableRow = memo(({ 
  children, 
  onClick, 
  className = '', 
  isClickable = false 
}) => {
  const { theme } = useTheme()
  
  const rowClasses = useMemo(() => {
    const baseClasses = 'border-b border-gray-200 dark:border-gray-700'
    const clickableClasses = isClickable 
      ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700' 
      : ''
    
    return combineThemeClasses(
      `${baseClasses} ${clickableClasses}`,
      themeClasses.table.row
    ) + ` ${className}`
  }, [isClickable, className, theme])

  return (
    <tr className={rowClasses} onClick={onClick}>
      {children}
    </tr>
  )
})

TableRow.displayName = 'TableRow'

// Memoized Loading Spinner Component
export const LoadingSpinner = memo(({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  }

  return (
    <div className={`animate-spin rounded-full border-2 border-gray-300 border-t-primary-500 ${sizeClasses[size]} ${className}`} />
  )
})

LoadingSpinner.displayName = 'LoadingSpinner'

// Memoized Empty State Component
export const EmptyState = memo(({ 
  icon: Icon, 
  title, 
  description, 
  action, 
  className = '' 
}) => {
  const { theme } = useTheme()
  
  const containerClasses = useMemo(() => {
    return combineThemeClasses(
      'flex flex-col items-center justify-center py-12 px-4 text-center',
      themeClasses.card
    ) + ` ${className}`
  }, [className, theme])

  return (
    <div className={containerClasses}>
      {Icon && <Icon className="h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />}
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          {description}
        </p>
      )}
      {action && action}
    </div>
  )
})

EmptyState.displayName = 'EmptyState'
