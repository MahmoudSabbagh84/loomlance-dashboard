import React from 'react'
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
  ArrowRight
} from 'lucide-react'
import { format } from 'date-fns'

const Dashboard = () => {
  const { invoices, contracts, clients } = useData()
  const { theme } = useTheme()

  // Calculate statistics
  const totalInvoices = invoices.length
  const paidInvoices = invoices.filter(invoice => invoice.status === 'paid').length
  const pendingInvoices = invoices.filter(invoice => invoice.status === 'pending').length
  const totalRevenue = invoices
    .filter(invoice => invoice.status === 'paid')
    .reduce((sum, invoice) => sum + parseFloat(invoice.amount || 0), 0)

  const activeContracts = contracts.filter(contract => contract.status === 'active').length
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
      change: '+12%',
      changeType: 'positive'
    },
    {
      name: 'Active Contracts',
      value: activeContracts,
      icon: FileCheck,
      change: '+2',
      changeType: 'positive'
    },
    {
      name: 'Total Clients',
      value: totalClients,
      icon: Users,
      change: '+1',
      changeType: 'positive'
    },
    {
      name: 'Pending Invoices',
      value: pendingInvoices,
      icon: Clock,
      change: '-3',
      changeType: 'negative'
    }
  ]

  return (
    <div className="space-y-6">
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
              <dd className="ml-16 flex items-baseline pb-6 sm:pb-7">
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {stat.value}
                </p>
                <p className={`ml-2 flex items-baseline text-sm font-semibold ${
                  stat.changeType === 'positive' 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {stat.change}
                </p>
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
                className={combineThemeClasses("relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm flex items-center space-x-3 hover:border-gray-400 focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2", themeClasses.quickAction.container)}
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
