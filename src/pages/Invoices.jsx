import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { useTheme } from '../context/ThemeContext'
import { themeClasses, combineThemeClasses } from '../styles/theme'
import InvoiceModal from '../components/InvoiceModal'
import InvoiceTemplate from '../components/InvoiceTemplate'
import ContractDetailsModal from '../components/ContractDetailsModal'
import { 
  Plus, 
  Edit, 
  Trash2, 
  Download, 
  Eye,
  X,
  CheckCircle,
  Clock,
  AlertCircle,
  CheckCheck,
  FileText,
  Building2
} from 'lucide-react'
import { format } from 'date-fns'

const Invoices = () => {
  const { invoices, addInvoice, updateInvoice, deleteInvoice, markInvoiceAsPaid, markInvoiceAsPending, markAllInvoicesAsPaid, contracts } = useData()
  const { theme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState(null)
  const [viewingInvoice, setViewingInvoice] = useState(null)
  const [selectedContract, setSelectedContract] = useState(null)
  const [showContractModal, setShowContractModal] = useState(false)
  const [highlightedInvoiceId, setHighlightedInvoiceId] = useState(null)

  // Handle highlighting from navigation
  useEffect(() => {
    if (location.state?.highlightInvoiceId) {
      setHighlightedInvoiceId(location.state.highlightInvoiceId)
      // Clear the highlight after 3 seconds
      setTimeout(() => setHighlightedInvoiceId(null), 3000)
    }
  }, [location.state])

  const handleSave = (invoice) => {
    if (editingInvoice) {
      updateInvoice(invoice)
    } else {
      addInvoice(invoice)
    }
    setIsModalOpen(false)
    setEditingInvoice(null)
  }

  const handleEdit = (invoice) => {
    setEditingInvoice(invoice)
    setIsModalOpen(true)
  }

  const handleView = (invoice) => {
    setViewingInvoice(invoice)
  }

  const handleContractClick = (contractId) => {
    const contract = contracts.find(c => c.id === contractId)
    if (contract) {
      setSelectedContract(contract)
      setShowContractModal(true)
    }
  }

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this invoice?')) {
      deleteInvoice(id)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return 'bg-success-50 text-success-600 dark:bg-success-900 dark:text-success-300'
      case 'pending':
        return 'bg-warning-50 text-warning-600 dark:bg-warning-900 dark:text-warning-300'
      case 'overdue':
        return 'bg-error-50 text-error-600 dark:bg-error-900 dark:text-error-300'
      default:
        return 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-300'
    }
  }

  // Show invoice template if viewing
  if (viewingInvoice) {
    return <InvoiceTemplate invoice={viewingInvoice} onClose={() => setViewingInvoice(null)} />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-text-primary dark:text-white">
            Invoices
          </h1>
          <p className="mt-2 text-sm text-text-secondary dark:text-gray-300">
            Manage your invoices and track payments
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={markAllInvoicesAsPaid}
              className={combineThemeClasses("inline-flex items-center rounded-md bg-green-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600", themeClasses.button.primary)}
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark All Paid
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingInvoice(null)
                setIsModalOpen(true)
              }}
              className={combineThemeClasses("btn btn-primary", themeClasses.button.primary)}
            >
              <Plus className="h-4 w-4 inline mr-2" />
              Add Invoice
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className={combineThemeClasses("bg-white shadow ring-1 ring-black ring-opacity-5 md:rounded-lg", themeClasses.card)}>
        <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
          <thead className={combineThemeClasses("bg-gray-50 dark:bg-gray-800", themeClasses.table.header)}>
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Client
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Contract
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Due Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Status
              </th>
              <th className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {invoices.map((invoice) => (
              <tr 
                key={invoice.id} 
                className={`${combineThemeClasses("hover:bg-gray-50 dark:hover:bg-gray-700", themeClasses.table.rowHover)} ${
                  highlightedInvoiceId === invoice.id ? 'ring-2 ring-orange-500 bg-orange-50 dark:bg-orange-900/20' : ''
                }`}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {(invoice.type || 'standalone') === 'contract-based' ? (
                      <Building2 className="h-4 w-4 text-primary-500 mr-2" />
                    ) : (
                      <FileText className="h-4 w-4 text-text-muted mr-2" />
                    )}
                    <span className="text-sm text-text-primary dark:text-white">
                      {(invoice.type || 'standalone') === 'contract-based' ? 'Contract' : 'Standalone'}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                  {invoice.clientName || 'Unknown Client'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {invoice.contractId ? (
                    <div className="flex items-center">
                      <Building2 className="h-4 w-4 text-primary-500 mr-2" />
                      <button
                        onClick={() => handleContractClick(invoice.contractId)}
                        className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-200 underline"
                        title="View Contract Details"
                      >
                        {contracts.find(c => c.id === invoice.contractId)?.title || 'Unknown Contract'}
                      </button>
                    </div>
                  ) : (
                    <span className="text-text-muted dark:text-gray-500">Standalone</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  ${(invoice.amount || 0).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {invoice.dueDate ? format(new Date(invoice.dueDate), 'MMM dd, yyyy') : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(invoice.status || 'pending')}`}>
                    {invoice.status || 'pending'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center space-x-2">
                    {/* Quick Status Actions */}
                    {(invoice.status || 'pending') === 'pending' && (
                      <button
                        onClick={() => markInvoiceAsPaid(invoice.id)}
                        className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                        title="Mark as Paid"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </button>
                    )}
                    {(invoice.status || 'pending') === 'paid' && (
                      <button
                        onClick={() => markInvoiceAsPending(invoice.id)}
                        className="text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300"
                        title="Mark as Pending"
                      >
                        <Clock className="h-4 w-4" />
                      </button>
                    )}
                    {(invoice.status || 'pending') === 'overdue' && (
                      <button
                        onClick={() => markInvoiceAsPaid(invoice.id)}
                        className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                        title="Mark as Paid"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </button>
                    )}
                    
                    {/* Standard Actions */}
                    <button
                      onClick={() => handleView(invoice)}
                      className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300"
                      title="View Invoice"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleEdit(invoice)}
                      className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300"
                      title="Edit Invoice"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(invoice.id)}
                      className="text-error-600 hover:text-error-900 dark:text-error-400 dark:hover:text-error-300"
                      title="Delete Invoice"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan="7" className="px-6 py-4 text-center text-sm text-text-secondary dark:text-gray-400">
                  No invoices found. Create your first invoice to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Invoice Modal */}
      <InvoiceModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingInvoice(null)
        }}
        editingInvoice={editingInvoice}
        onSave={handleSave}
      />

      {/* Contract Details Modal */}
      <ContractDetailsModal
        contract={selectedContract}
        isOpen={showContractModal}
        onClose={() => {
          setShowContractModal(false)
          setSelectedContract(null)
        }}
      />
    </div>
  )
}

export default Invoices
