import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { useTheme } from '../context/ThemeContext'
import { themeClasses, combineThemeClasses } from '../styles/theme'
import { 
  FileText, 
  FileCheck, 
  Users, 
  DollarSign,
  TrendingUp,
  Clock,
  Plus,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  X
} from 'lucide-react'
import { format } from 'date-fns'

const Dashboard = () => {
  const { invoices, contracts, clients } = useData()
  const { theme } = useTheme()
  const [showAutoUpdateNotification, setShowAutoUpdateNotification] = useState(false)
  const [notificationCountdown, setNotificationCountdown] = useState(8)
  const [hasAutoUpdated, setHasAutoUpdated] = useState(false)

  // Check for auto-updated items on component mount
  useEffect(() => {
    // Check if auto-updates occurred
    const wasAutoUpdated = localStorage.getItem('loomlance-auto-updated') === 'true'
    
    if (wasAutoUpdated && !hasAutoUpdated) {
      setShowAutoUpdateNotification(true)
      setHasAutoUpdated(true)
      setNotificationCountdown(8)
      // Clear the flag so notification doesn't show again
      localStorage.removeItem('loomlance-auto-updated')
    }
  }, [hasAutoUpdated])

  // Countdown timer for notification
  useEffect(() => {
    let interval = null
    if (showAutoUpdateNotification && notificationCountdown > 0) {
      interval = setInterval(() => {
        setNotificationCountdown(countdown => {
          if (countdown <= 1) {
            setShowAutoUpdateNotification(false)
            return 0
          }
          return countdown - 1
        })
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [showAutoUpdateNotification, notificationCountdown])

  // Calculate countdown bar width based on remaining time
  const countdownBarWidth = (notificationCountdown / 8) * 100

  // Calculate statistics
  const totalInvoices = invoices.length
  const paidInvoices = invoices.filter(invoice => invoice.status === 'paid').length
  const pendingInvoices = invoices.filter(invoice => invoice.status === 'pending').length
  const overdueInvoices = invoices.filter(invoice => invoice.status === 'overdue').length
  
  const totalRevenue = invoices
    .filter(invoice => invoice.status === 'paid')
    .reduce((sum, invoice) => sum + parseFloat(invoice.amount || 0), 0)
  
  const pendingRevenue = invoices
    .filter(invoice => invoice.status === 'pending')
    .reduce((sum, invoice) => sum + parseFloat(invoice.amount || 0), 0)
  
  const overdueRevenue = invoices
    .filter(invoice => invoice.status === 'overdue')
    .reduce((sum, invoice) => sum + parseFloat(invoice.amount || 0), 0)

  const activeContracts = contracts.filter(contract => contract.status === 'active').length
  const pendingContracts = contracts.filter(contract => contract.status === 'pending').length
  const totalClients = clients.length

  // Recent items
  const recentInvoices = invoices.slice(-3).reverse()
  const recentContracts = contracts.slice(-3).reverse()

  const quickActions = [
    {
      name: 'Create Invoice',
      href: '/invoices',
      icon: FileText,
      description: 'Send a new invoice',
      color: 'text-blue-600 dark:text-blue-400'
    },
    {
      name: 'Add Contract',
      href: '/contracts',
      icon: FileCheck,
      description: 'Create a new contract',
      color: 'text-green-600 dark:text-green-400'
    },
    {
      name: 'Add Client',
      href: '/clients',
      icon: Users,
      description: 'Add a new client',
      color: 'text-purple-600 dark:text-purple-400'
    }
  ]

  const stats = [
    {
      name: 'Total Revenue',
      value: `$${totalRevenue.toLocaleString()}`,
      icon: DollarSign,
      change: pendingRevenue > 0 ? `+$${pendingRevenue.toLocaleString()} pending` : 'No pending',
      changeType: pendingRevenue > 0 ? 'positive' : 'neutral',
      additionalInfo: overdueRevenue > 0 ? `$${overdueRevenue.toLocaleString()} overdue` : null,
      additionalType: 'negative'
    },
    {
      name: 'Active Contracts',
      value: activeContracts,
      icon: FileCheck,
      change: pendingContracts > 0 ? `+${pendingContracts} pending` : 'No pending',
      changeType: pendingContracts > 0 ? 'positive' : 'neutral'
    },
    {
      name: 'Total Clients',
      value: totalClients,
      icon: Users,
      change: null,
      changeType: 'neutral'
    },
    {
      name: 'Pending Invoices',
      value: pendingInvoices,
      icon: Clock,
      change: overdueInvoices > 0 ? `${overdueInvoices} overdue` : 'All on time',
      changeType: overdueInvoices > 0 ? 'negative' : 'positive'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Auto-Update Notification */}
      {showAutoUpdateNotification && (
        <div className="relative rounded-md bg-blue-50 dark:bg-blue-900/20 p-4 overflow-hidden">
          <div className="flex">
            <div className="flex-shrink-0">
              <CheckCircle className="h-5 w-5 text-blue-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Auto-Update Complete
              </h3>
              <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                <p>
                  Some invoices have been automatically marked as overdue and contracts as expired based on their due dates.
                </p>
              </div>
            </div>
            <div className="ml-auto pl-3">
              <div className="-mx-1.5 -my-1.5">
                <button
                  type="button"
                  onClick={() => setShowAutoUpdateNotification(false)}
                  className="inline-flex rounded-md bg-blue-50 dark:bg-blue-900/20 p-1.5 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-800/20 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 focus:ring-offset-blue-50 dark:focus:ring-offset-blue-900"
                >
                  <span className="sr-only">Dismiss</span>
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
          
          {/* Countdown Bar */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-200 dark:bg-blue-800">
            <div 
              className="h-full bg-blue-500 dark:bg-blue-400"
              style={{ 
                width: `${countdownBarWidth}%`
              }}
            />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 dark:text-white sm:truncate sm:text-3xl sm:tracking-tight">
            Dashboard
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Welcome back! Here's what's happening with your business.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.name} className={combineThemeClasses("relative overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:px-6 sm:py-6", themeClasses.card)}>
              <dt>
                <div className="absolute rounded-md bg-primary-500 p-3">
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <p className="ml-16 truncate text-sm font-medium text-gray-500 dark:text-gray-400">
                  {stat.name}
                </p>
              </dt>
              <dd className="ml-16 pb-6 sm:pb-7">
                <div className="flex items-baseline">
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {stat.value}
                  </p>
                </div>
                {(stat.change || stat.additionalInfo) && (
                  <div className="mt-1 flex items-center space-x-4">
                    {stat.change && (
                      <p className={`text-sm font-semibold ${
                        stat.changeType === 'positive' 
                          ? 'text-green-600 dark:text-green-400' 
                          : stat.changeType === 'negative'
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {stat.change}
                      </p>
                    )}
                    {stat.additionalInfo && (
                      <p className={`text-sm font-semibold ${
                        stat.additionalType === 'negative'
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {stat.additionalInfo}
                      </p>
                    )}
                  </div>
                )}
              </dd>
            </div>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <Link
                key={action.name}
                to={action.href}
                className={combineThemeClasses("relative rounded-lg border border-gray-300 bg-white dark:bg-gray-800 px-6 py-5 shadow-sm flex items-center space-x-3 hover:border-gray-400 dark:hover:border-gray-600 focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2", themeClasses.quickAction.container)}
              >
                <div className="flex-shrink-0">
                  <Icon className={`h-6 w-6 ${action.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="absolute inset-0" aria-hidden="true" />
                  <p className={combineThemeClasses("text-sm font-medium", themeClasses.quickAction.text)}>
                    {action.name}
                  </p>
                  <p className={combineThemeClasses("text-sm", themeClasses.quickAction.subtitle)}>
                    {action.description}
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </Link>
            )
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Invoices */}
        <div className={combineThemeClasses("bg-white shadow rounded-lg", themeClasses.card)}>
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Recent Invoices
              </h3>
              <Link
                to="/invoices"
                className="text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
              >
                View all
              </Link>
            </div>
            <div className="flow-root">
              <ul className="-my-5 divide-y divide-gray-200 dark:divide-gray-700">
                {recentInvoices.map((invoice) => (
                  <li key={invoice.id} className="py-4">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <FileText className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {invoice.clientName}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          ${invoice.amount} • {format(new Date(invoice.dueDate), 'MMM dd, yyyy')}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          invoice.status === 'paid' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                        }`}>
                          {invoice.status}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
                {recentInvoices.length === 0 && (
                  <li className="py-4 text-center text-gray-500 dark:text-gray-400">
                    No invoices yet
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* Recent Contracts */}
        <div className={combineThemeClasses("bg-white shadow rounded-lg", themeClasses.card)}>
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Recent Contracts
              </h3>
              <Link
                to="/contracts"
                className="text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
              >
                View all
              </Link>
            </div>
            <div className="flow-root">
              <ul className="-my-5 divide-y divide-gray-200 dark:divide-gray-700">
                {recentContracts.map((contract) => (
                  <li key={contract.id} className="py-4">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <FileCheck className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {contract.title}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {contract.clientName} • {format(new Date(contract.startDate), 'MMM dd, yyyy')}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          contract.status === 'active' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {contract.status}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
                {recentContracts.length === 0 && (
                  <li className="py-4 text-center text-gray-500 dark:text-gray-400">
                    No contracts yet
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
