import React, { useState } from 'react'
import { useData } from '../context/DataContext'
import { useTheme } from '../context/ThemeContext'
import { themeClasses, combineThemeClasses } from '../styles/theme'
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye,
  X,
  CheckCircle,
  Clock,
  AlertCircle,
  PlayCircle
} from 'lucide-react'
import { format } from 'date-fns'

const Contracts = () => {
  const { contracts, addContract, updateContract, deleteContract, markContractAsActive, markContractAsCompleted, markContractAsPending } = useData()
  const { theme } = useTheme()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingContract, setEditingContract] = useState(null)
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'completed':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
      case 'expired':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Contracts
          </h1>
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
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
            className={combineThemeClasses("block rounded-md bg-primary-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600", themeClasses.button.primary)}
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
              <th className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {contracts.map((contract) => (
              <tr key={contract.id} className={combineThemeClasses("hover:bg-gray-50 dark:hover:bg-gray-700", themeClasses.table.rowHover)}>
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
                        onClick={() => markContractAsCompleted(contract.id)}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        title="Mark as Completed"
                      >
                        <CheckCircle className="h-4 w-4" />
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
                <td colSpan="6" className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
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
    </div>
  )
}

export default Contracts
