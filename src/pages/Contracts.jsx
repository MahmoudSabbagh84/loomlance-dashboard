import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { useTheme } from '../context/ThemeContext'
import { themeClasses, combineThemeClasses } from '../styles/theme'
import InvoiceModal from '../components/InvoiceModal'
import InvoiceListModal from '../components/InvoiceListModal'
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye,
  X,
  CheckCircle,
  Clock,
  AlertCircle,
  PlayCircle,
  FileText,
  Building2
} from 'lucide-react'
import { format } from 'date-fns'

const Contracts = () => {
  const { contracts, addContract, updateContract, deleteContract, markContractAsActive, markContractAsCompleted, markContractAsPending, invoices, addInvoice } = useData()
  const { theme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingContract, setEditingContract] = useState(null)
  const [showInvoiceNotification, setShowInvoiceNotification] = useState(false)
  const [completedContractId, setCompletedContractId] = useState(null)
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false)
  const [selectedContractForInvoice, setSelectedContractForInvoice] = useState(null)
  const [selectedContractForInvoices, setSelectedContractForInvoices] = useState(null)
  const [showInvoiceListModal, setShowInvoiceListModal] = useState(false)
  const [highlightedContractId, setHighlightedContractId] = useState(null)

  // Handle highlighting from navigation
  useEffect(() => {
    if (location.state?.highlightContractId) {
      setHighlightedContractId(location.state.highlightContractId)
      // Clear the highlight after 3 seconds
      setTimeout(() => setHighlightedContractId(null), 3000)
    }
  }, [location.state])
  const [formData, setFormData] = useState({
    title: '',
    clientName: '',
    startDate: '',
    endDate: '',
    status: 'active',
    description: ''
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const contract = {
      ...formData,
      id: editingContract?.id || Date.now(),
      startDate: formData.startDate,
      endDate: formData.endDate,
      createdAt: editingContract?.createdAt || new Date().toISOString()
    }

    if (editingContract) {
      updateContract(contract)
    } else {
      addContract(contract)
    }

    setIsModalOpen(false)
    setEditingContract(null)
    setFormData({
      title: '',
      clientName: '',
      startDate: '',
      endDate: '',
      status: 'active',
      description: ''
    })
  }

  const handleEdit = (contract) => {
    setEditingContract(contract)
    setFormData({
      title: contract.title,
      clientName: contract.clientName,
      startDate: contract.startDate,
      endDate: contract.endDate,
      status: contract.status,
      description: contract.description || ''
    })
    setIsModalOpen(true)
  }

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this contract?')) {
      deleteContract(id)
    }
  }

  const handleMarkCompleted = (id) => {
    markContractAsCompleted(id)
    setCompletedContractId(id)
    setShowInvoiceNotification(true)
    
    // Hide notification after 5 seconds
    setTimeout(() => {
      setShowInvoiceNotification(false)
      setCompletedContractId(null)
    }, 5000)
  }

  const handleGenerateInvoice = (contract) => {
    setSelectedContractForInvoice(contract)
    setIsInvoiceModalOpen(true)
  }

  const handleInvoiceSave = (invoice) => {
    addInvoice(invoice)
    setIsInvoiceModalOpen(false)
    setSelectedContractForInvoice(null)
  }

  const getContractInvoices = (contractId) => {
    return invoices.filter(invoice => invoice.contractId === contractId)
  }

  const getContractInvoiceTotal = (contractId) => {
    const contractInvoices = getContractInvoices(contractId)
    return contractInvoices.reduce((total, invoice) => total + (invoice.amount || 0), 0)
  }

  const handleInvoiceListClick = (contract) => {
    setSelectedContractForInvoices(contract)
    setShowInvoiceListModal(true)
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-success-50 text-success-600 dark:bg-success-900 dark:text-success-300'
      case 'completed':
        return 'bg-primary-50 text-primary-600 dark:bg-primary-900 dark:text-primary-300'
      case 'expired':
        return 'bg-error-50 text-error-600 dark:bg-error-900 dark:text-error-300'
      default:
        return 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-300'
    }
  }

  return (
    <div className="space-y-6">
      {/* Invoice Generation Notification */}
      {showInvoiceNotification && completedContractId && (
        <div className="relative rounded-xl bg-success-50 dark:bg-success-900/20 p-4 border border-success-200 dark:border-success-800">
          <div className="flex">
            <div className="flex-shrink-0">
              <CheckCircle className="h-5 w-5 text-success-500 dark:text-success-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-success-800 dark:text-success-200">
                Contract Completed & Invoice Generated
              </h3>
              <div className="mt-2 text-sm text-success-700 dark:text-success-300">
                <p>
                  The contract has been marked as completed and an invoice has been automatically generated and added to your invoices list.
                </p>
              </div>
            </div>
            <div className="ml-auto pl-3">
              <button
                type="button"
                onClick={() => setShowInvoiceNotification(false)}
                className="inline-flex rounded-lg bg-success-50 dark:bg-success-900/20 p-1.5 text-success-500 hover:bg-success-100 dark:hover:bg-success-800/20 transition-all duration-300"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-text-primary dark:text-white">
            Contracts
          </h1>
          <p className="mt-2 text-sm text-text-secondary dark:text-gray-300">
            Manage your contracts and agreements
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <button
            type="button"
            onClick={() => {
              setEditingContract(null)
              setFormData({
                title: '',
                clientName: '',
                startDate: '',
                endDate: '',
                status: 'active',
                description: ''
              })
              setIsModalOpen(true)
            }}
            className={combineThemeClasses("btn btn-primary", themeClasses.button.primary)}
          >
            <Plus className="h-4 w-4 inline mr-2" />
            Add Contract
          </button>
        </div>
      </div>

      {/* Table */}
      <div className={combineThemeClasses("bg-white shadow ring-1 ring-black ring-opacity-5 md:rounded-lg", themeClasses.card)}>
        <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
          <thead className={combineThemeClasses("bg-gray-50 dark:bg-gray-800", themeClasses.table.header)}>
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Title
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Client
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Start Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                End Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Invoices
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Total Billed
              </th>
              <th className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {contracts.map((contract) => (
              <tr 
                key={contract.id} 
                className={`${combineThemeClasses("hover:bg-gray-50 dark:hover:bg-gray-700", themeClasses.table.rowHover)} ${
                  highlightedContractId === contract.id ? 'ring-2 ring-orange-500 bg-orange-50 dark:bg-orange-900/20' : ''
                }`}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                  {contract.title}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {contract.clientName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {format(new Date(contract.startDate), 'MMM dd, yyyy')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {format(new Date(contract.endDate), 'MMM dd, yyyy')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(contract.status)}`}>
                    {contract.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  <div className="flex items-center">
                    <FileText className="h-4 w-4 text-primary-500 mr-2" />
                    <button
                      onClick={() => handleInvoiceListClick(contract)}
                      className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-200 underline"
                      title="View Invoices"
                    >
                      {getContractInvoices(contract.id).length} invoice{getContractInvoices(contract.id).length !== 1 ? 's' : ''}
                    </button>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  ${getContractInvoiceTotal(contract.id).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center space-x-2">
                    {/* Quick Status Actions */}
                    {contract.status === 'pending' && (
                      <button
                        onClick={() => markContractAsActive(contract.id)}
                        className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                        title="Activate Contract"
                      >
                        <PlayCircle className="h-4 w-4" />
                      </button>
                    )}
                    {contract.status === 'active' && (
                      <button
                        onClick={() => handleMarkCompleted(contract.id)}
                        className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300"
                        title="Mark as Completed"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </button>
                    )}
                    {(contract.status === 'active' || contract.status === 'completed') && (
                      <button
                        onClick={() => handleGenerateInvoice(contract)}
                        className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                        title="Generate Invoice"
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                    )}
                    {contract.status === 'completed' && (
                      <button
                        onClick={() => markContractAsActive(contract.id)}
                        className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                        title="Reactivate Contract"
                      >
                        <PlayCircle className="h-4 w-4" />
                      </button>
                    )}
                    {contract.status === 'expired' && (
                      <button
                        onClick={() => markContractAsPending(contract.id)}
                        className="text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300"
                        title="Mark as Pending"
                      >
                        <Clock className="h-4 w-4" />
                      </button>
                    )}
                    
                    {/* Standard Actions */}
                    <button
                      onClick={() => handleEdit(contract)}
                      className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300"
                      title="Edit Contract"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(contract.id)}
                      className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                      title="Delete Contract"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <button 
                      className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300"
                      title="View Contract"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {contracts.length === 0 && (
              <tr>
                <td colSpan="8" className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  No contracts found. Create your first contract to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className={combineThemeClasses("flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0", themeClasses.modal.overlay)}>
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsModalOpen(false)} />
            <div className="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle dark:bg-gray-800">
              <form onSubmit={handleSubmit}>
                <div className={combineThemeClasses("px-4 pt-5 pb-4 sm:p-6 sm:pb-4", themeClasses.modal.header)}>
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                      <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
                        {editingContract ? 'Edit Contract' : 'Create Contract'}
                      </h3>
                      <div className="mt-4 space-y-6">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <label className={combineThemeClasses("block text-sm font-medium", themeClasses.form.label)}>
                              Contract Title <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="e.g., Web Development Agreement"
                              className={combineThemeClasses("mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm", themeClasses.input)}
                              value={formData.title}
                              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className={combineThemeClasses("block text-sm font-medium", themeClasses.form.label)}>
                              Client Name <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="Enter client name"
                              className={combineThemeClasses("mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm", themeClasses.input)}
                              value={formData.clientName}
                              onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                            />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <label className={combineThemeClasses("block text-sm font-medium", themeClasses.form.label)}>
                              Start Date <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="date"
                              required
                              className={combineThemeClasses("mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm", themeClasses.input)}
                              value={formData.startDate}
                              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className={combineThemeClasses("block text-sm font-medium", themeClasses.form.label)}>
                              End Date <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="date"
                              required
                              className={combineThemeClasses("mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm", themeClasses.input)}
                              value={formData.endDate}
                              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                            />
                          </div>
                        </div>
                        
                        <div>
                          <label className={combineThemeClasses("block text-sm font-medium", themeClasses.form.label)}>
                            Contract Status
                          </label>
                          <select
                            className={combineThemeClasses("mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm", themeClasses.input)}
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                          >
                            <option value="active">Active</option>
                            <option value="pending">Pending</option>
                            <option value="completed">Completed</option>
                            <option value="expired">Expired</option>
                          </select>
                          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Set the current status of this contract
                          </p>
                        </div>
                        
                        <div>
                          <label className={combineThemeClasses("block text-sm font-medium", themeClasses.form.label)}>
                            Project Description
                          </label>
                          <textarea
                            rows={4}
                            placeholder="Describe the scope of work, deliverables, and key terms..."
                            className={combineThemeClasses("mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm", themeClasses.input)}
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          />
                          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Include project scope, deliverables, and any important terms
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className={combineThemeClasses("px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6", themeClasses.modal.footer)}>
                  <button
                    type="submit"
                    className={combineThemeClasses("inline-flex w-full justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm", themeClasses.button.primary)}
                  >
                    {editingContract ? 'Update' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className={combineThemeClasses("mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600", themeClasses.button.secondary)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      <InvoiceModal
        isOpen={isInvoiceModalOpen}
        onClose={() => {
          setIsInvoiceModalOpen(false)
          setSelectedContractForInvoice(null)
        }}
        editingInvoice={selectedContractForInvoice ? {
          type: 'contract-based',
          contractId: selectedContractForInvoice.id,
          clientName: selectedContractForInvoice.clientName,
          description: `Invoice for ${selectedContractForInvoice.title}`,
          lineItems: [{
            description: selectedContractForInvoice.title,
            quantity: selectedContractForInvoice.estimatedHours || 1,
            rate: selectedContractForInvoice.hourlyRate || 0,
            amount: selectedContractForInvoice.totalValue || 0
          }],
          subtotal: selectedContractForInvoice.totalValue || 0,
          tax: 0,
          taxPercentage: 0,
          total: selectedContractForInvoice.totalValue || 0,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          status: 'pending'
        } : null}
        onSave={handleInvoiceSave}
      />

      {/* Invoice List Modal */}
      <InvoiceListModal
        invoices={selectedContractForInvoices ? getContractInvoices(selectedContractForInvoices.id) : []}
        contract={selectedContractForInvoices}
        isOpen={showInvoiceListModal}
        onClose={() => {
          setShowInvoiceListModal(false)
          setSelectedContractForInvoices(null)
        }}
      />
    </div>
  )
}

export default Contracts
