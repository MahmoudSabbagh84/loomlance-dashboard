import React, { useState } from 'react'
import { useData } from '../context/DataContext'
import { useTheme } from '../context/ThemeContext'
import { themeClasses, combineThemeClasses } from '../styles/theme'
import { 
  Archive as ArchiveIcon,
  FileText,
  Building2,
  Users,
  RotateCcw,
  Trash2,
  Eye
} from 'lucide-react'
import { format } from 'date-fns'

const Archive = () => {
  const { 
    archivedContracts, 
    archivedInvoices, 
    archivedClients,
    restoreContract,
    restoreInvoice,
    restoreClient,
    deleteContract,
    deleteInvoice,
    deleteClient
  } = useData()
  const { theme } = useTheme()
  const [activeTab, setActiveTab] = useState('contracts')

  const tabs = [
    { id: 'contracts', label: 'Contracts', icon: Building2, count: archivedContracts.length },
    { id: 'invoices', label: 'Invoices', icon: FileText, count: archivedInvoices.length },
    { id: 'clients', label: 'Clients', icon: Users, count: archivedClients.length }
  ]

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
      case 'completed': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
      case 'expired': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
      case 'paid': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'overdue': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
    }
  }

  const renderContracts = () => (
    <div className="space-y-4">
      {archivedContracts.length === 0 ? (
        <div className="text-center py-12">
          <ArchiveIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No archived contracts</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Contracts that are archived will appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {archivedContracts.map((contract) => (
            <div key={contract.id} className={combineThemeClasses("bg-white shadow rounded-lg p-6", themeClasses.card)}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    {contract.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {contract.clientName}
                  </p>
                  <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                    <span>
                      {format(new Date(contract.startDate), 'MMM dd, yyyy')} - {format(new Date(contract.endDate), 'MMM dd, yyyy')}
                    </span>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(contract.status)}`}>
                      {contract.status}
                    </span>
                    <span>${(contract.totalValue || 0).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => restoreContract(contract.id)}
                    className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                    title="Restore Contract"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Are you sure you want to permanently delete this contract?')) {
                        deleteContract(contract.id)
                      }
                    }}
                    className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    title="Delete Permanently"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const renderInvoices = () => (
    <div className="space-y-4">
      {archivedInvoices.length === 0 ? (
        <div className="text-center py-12">
          <ArchiveIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No archived invoices</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Invoices that are archived will appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {archivedInvoices.map((invoice) => (
            <div key={invoice.id} className={combineThemeClasses("bg-white shadow rounded-lg p-6", themeClasses.card)}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    {invoice.invoiceNumber}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {invoice.clientName}
                  </p>
                  <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                    <span>${(invoice.amount || 0).toLocaleString()}</span>
                    <span>
                      Due: {format(new Date(invoice.dueDate), 'MMM dd, yyyy')}
                    </span>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(invoice.status)}`}>
                      {invoice.status}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => restoreInvoice(invoice.id)}
                    className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                    title="Restore Invoice"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Are you sure you want to permanently delete this invoice?')) {
                        deleteInvoice(invoice.id)
                      }
                    }}
                    className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    title="Delete Permanently"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const renderClients = () => (
    <div className="space-y-4">
      {archivedClients.length === 0 ? (
        <div className="text-center py-12">
          <ArchiveIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No archived clients</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Clients that are archived will appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {archivedClients.map((client) => (
            <div key={client.id} className={combineThemeClasses("bg-white shadow rounded-lg p-6", themeClasses.card)}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    {client.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {client.company}
                  </p>
                  <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                    <span>{client.email}</span>
                    <span>{client.phone}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => restoreClient(client.id)}
                    className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                    title="Restore Client"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Are you sure you want to permanently delete this client?')) {
                        deleteClient(client.id)
                      }
                    }}
                    className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    title="Delete Permanently"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-text-primary dark:text-white">
            Archive
          </h1>
          <p className="mt-2 text-sm text-text-secondary dark:text-gray-300">
            View and manage archived contracts, invoices, and clients
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                  activeTab === tab.id 
                    ? 'bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                }`}>
                  {tab.count}
                </span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="mt-6">
        {activeTab === 'contracts' && renderContracts()}
        {activeTab === 'invoices' && renderInvoices()}
        {activeTab === 'clients' && renderClients()}
      </div>
    </div>
  )
}

export default Archive
