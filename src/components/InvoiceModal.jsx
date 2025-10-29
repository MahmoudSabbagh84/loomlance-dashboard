import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react'
import { useContracts, useClients } from '../context/DataContext'
import { useUser } from '../context/AuthContext'
import { themeClasses, combineThemeClasses } from '../styles/theme'
import { 
  X, 
  Plus, 
  Trash2, 
  FileText,
  Calculator,
  Building2,
  User
} from 'lucide-react'

const InvoiceModal = memo(({ isOpen, onClose, editingInvoice, onSave }) => {
  const contracts = useContracts()
  const clients = useClients()
  const user = useUser()
  const modalRef = useRef(null)
  const [formData, setFormData] = useState({
    type: 'standalone', // 'standalone' or 'contract-based'
    contractId: '',
    clientName: '',
    amount: '',
    dueDate: '',
    status: 'pending',
    description: '',
    lineItems: [{ description: '', quantity: 1, rate: 0, amount: 0 }],
    subtotal: 0,
    tax: 0,
    taxPercentage: 0,
    total: 0
  })

  // Memoized filtered contracts
  const filteredContracts = useMemo(() => {
    return contracts.filter(contract => contract.status === 'active' || contract.status === 'completed')
  }, [contracts])

  // Memoized client options
  const clientOptions = useMemo(() => {
    return clients.map(client => ({
      value: client.name,
      label: client.name
    }))
  }, [clients])

  // Reset form when modal opens/closes or when editing changes
  useEffect(() => {
    if (isOpen) {
      if (editingInvoice) {
        // Safely handle potentially undefined properties
        const safeLineItems = editingInvoice.lineItems && Array.isArray(editingInvoice.lineItems) && editingInvoice.lineItems.length > 0
          ? editingInvoice.lineItems
          : [{ description: '', quantity: 1, rate: 0, amount: 0 }]
        
        setFormData({
          type: editingInvoice.type || 'standalone',
          contractId: editingInvoice.contractId ? editingInvoice.contractId.toString() : '',
          clientName: editingInvoice.clientName || '',
          amount: editingInvoice.amount?.toString() || '',
          dueDate: editingInvoice.dueDate || '',
          status: editingInvoice.status || 'pending',
          description: editingInvoice.description || '',
          lineItems: safeLineItems,
          subtotal: editingInvoice.subtotal || 0,
          tax: editingInvoice.tax || 0,
          taxPercentage: editingInvoice.taxPercentage || 0,
          total: editingInvoice.total || 0
        })
      } else {
        setFormData({
          type: 'standalone',
          contractId: '',
          clientName: '',
          amount: '',
          dueDate: '',
          status: 'pending',
          description: '',
          lineItems: [{ description: '', quantity: 1, rate: 0, amount: 0 }],
          subtotal: 0,
          tax: 0,
          taxPercentage: 0,
          total: 0
        })
      }
    }
  }, [isOpen, editingInvoice])

  // Auto-populate contract data when contract is selected
  useEffect(() => {
    if (formData.type === 'contract-based' && formData.contractId) {
      const selectedContract = contracts.find(c => c.id === parseInt(formData.contractId))
      if (selectedContract) {
        setFormData(prev => ({
          ...prev,
          clientName: selectedContract.clientName || '',
          description: `Invoice for ${selectedContract.title || 'Contract'}`,
          lineItems: [{
            description: selectedContract.title || 'Contract Work',
            quantity: selectedContract.estimatedHours || 1,
            rate: selectedContract.hourlyRate || 0,
            amount: selectedContract.totalValue || 0
          }],
          subtotal: selectedContract.totalValue || 0,
          total: selectedContract.totalValue || 0,
          amount: (selectedContract.totalValue || 0).toString()
        }))
      }
    }
  }, [formData.type, formData.contractId, contracts.length])

  // Calculate totals when line items or tax percentage change
  useEffect(() => {
    const subtotal = formData.lineItems.reduce((sum, item) => sum + (item.amount || 0), 0)
    const tax = subtotal * (formData.taxPercentage / 100)
    const total = subtotal + tax

    // Only update if values have actually changed to prevent infinite loops
    if (formData.subtotal !== subtotal || formData.tax !== tax || formData.total !== total) {
      setFormData(prev => ({
        ...prev,
        subtotal,
        tax,
        total,
        amount: total.toString()
      }))
    }
  }, [formData.lineItems, formData.taxPercentage, formData.subtotal, formData.tax, formData.total])

  const handleSubmit = useCallback((e) => {
    e.preventDefault()
    
    try {
      // Validate required fields
      if (!formData.clientName || !formData.dueDate) {
        alert('Please fill in all required fields (Client and Due Date)')
        return
      }

      // Validate line items
      if (!formData.lineItems || formData.lineItems.length === 0) {
        alert('Please add at least one line item')
        return
      }

      const invoice = {
        ...formData,
        id: editingInvoice?.id || Date.now(),
        amount: parseFloat(formData.total) || 0,
        contractUid: formData.type === 'contract-based' && formData.contractId ? contracts.find(c => c.id === parseInt(formData.contractId))?.uid : null,
        createdAt: editingInvoice?.createdAt || new Date().toISOString()
      }

      onSave(invoice)
      onClose()
    } catch (error) {
      console.error('Error submitting invoice:', error)
      alert('An error occurred while saving the invoice. Please try again.')
    }
  }, [formData, editingInvoice, contracts, onSave, onClose])

  const addLineItem = () => {
    setFormData(prev => ({
      ...prev,
      lineItems: [...(prev.lineItems || []), { description: '', quantity: 1, rate: 0, amount: 0 }]
    }))
  }

  const removeLineItem = (index) => {
    if (formData.lineItems && formData.lineItems.length > 1) {
      setFormData(prev => ({
        ...prev,
        lineItems: (prev.lineItems || []).filter((_, i) => i !== index)
      }))
    }
  }

  const updateLineItem = (index, field, value) => {
    if (!formData.lineItems || index < 0 || index >= formData.lineItems.length) {
      console.error('Invalid line item index:', index)
      return
    }

    const newLineItems = [...formData.lineItems]
    // Ensure the line item has all required properties with defaults
    const currentItem = newLineItems[index] || { description: '', quantity: 1, rate: 0, amount: 0 }
    newLineItems[index] = {
      description: currentItem.description || '',
      quantity: currentItem.quantity || 1,
      rate: currentItem.rate || 0,
      amount: currentItem.amount || 0,
      [field]: value
    }

    // Calculate amount for this line item
    if (field === 'quantity' || field === 'rate') {
      const quantity = field === 'quantity' ? parseFloat(value) || 0 : (newLineItems[index].quantity || 0)
      const rate = field === 'rate' ? parseFloat(value) || 0 : (newLineItems[index].rate || 0)
      newLineItems[index].amount = quantity * rate
    }

    setFormData(prev => ({
      ...prev,
      lineItems: newLineItems
    }))
  }

  // Show completed contracts for contract-based invoices
  const availableContracts = contracts.filter(c => c.status === 'completed' || c.status === 'active')
  const availableClients = clients

  // Focus management for modal
  useEffect(() => {
    if (isOpen) {
      // Remove focus from any active elements
      if (document.activeElement) {
        document.activeElement.blur()
      }
      // Focus the modal for accessibility
      if (modalRef.current) {
        modalRef.current.focus()
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className={combineThemeClasses("flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0", themeClasses.modal.overlay)}>
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        <div 
          ref={modalRef}
          className="inline-block transform overflow-hidden rounded-2xl bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl sm:align-middle dark:bg-gray-800"
          tabIndex={-1}
        >
          <form onSubmit={handleSubmit}>
            <div className={combineThemeClasses("px-6 pt-6 pb-4", themeClasses.modal.header)}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-text-primary dark:text-white">
                  {editingInvoice ? 'Edit Invoice' : 'Create Invoice'}
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-text-muted hover:text-text-primary dark:text-gray-400 dark:hover:text-white transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Invoice Type Selection */}
              <div className="mb-6">
                <label className={combineThemeClasses("block text-sm font-medium mb-3", themeClasses.form.label)}>
                  Invoice Type
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: 'standalone', contractId: '', clientName: '' }))}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      formData.type === 'standalone'
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-text-muted hover:border-primary-300'
                    }`}
                  >
                    <div className="flex items-center">
                      <FileText className={`h-5 w-5 mr-3 ${formData.type === 'standalone' ? 'text-primary-500' : 'text-text-muted'}`} />
                      <div className="text-left">
                        <div className={`font-medium ${formData.type === 'standalone' ? 'text-primary-700 dark:text-primary-300' : 'text-text-primary dark:text-white'}`}>
                          Standalone Invoice
                        </div>
                        <div className="text-sm text-text-secondary dark:text-gray-400">
                          Create a one-time invoice
                        </div>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: 'contract-based' }))}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      formData.type === 'contract-based'
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-text-muted hover:border-primary-300'
                    }`}
                  >
                    <div className="flex items-center">
                      <Building2 className={`h-5 w-5 mr-3 ${formData.type === 'contract-based' ? 'text-primary-500' : 'text-text-muted'}`} />
                      <div className="text-left">
                        <div className={`font-medium ${formData.type === 'contract-based' ? 'text-primary-700 dark:text-primary-300' : 'text-text-primary dark:text-white'}`}>
                          Contract-Based Invoice
                        </div>
                        <div className="text-sm text-text-secondary dark:text-gray-400">
                          Invoice based on existing contract
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Left Column - Basic Info */}
                <div className="space-y-6">
                  {/* Contract Selection (if contract-based) */}
                  {formData.type === 'contract-based' && (
                    <div>
                      <label className={combineThemeClasses("block text-sm font-medium mb-2", themeClasses.form.label)}>
                        Select Contract <span className="text-error-500">*</span>
                      </label>
                      <select
                        required
                        className={combineThemeClasses("w-full", themeClasses.input)}
                        value={formData.contractId || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, contractId: e.target.value }))}
                      >
                        <option value="">Choose a contract...</option>
                        {availableContracts.map(contract => (
                          <option key={contract.id} value={contract.id}>
                            {contract.title} - {contract.clientName} (${(contract.totalValue || 0).toLocaleString()}) - {contract.status}
                          </option>
                        ))}
                      </select>
                      
                      {/* Contract Details Display */}
                      {formData.contractId && (
                        <div className="mt-4 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
                          <div className="flex items-center mb-3">
                            <Building2 className="h-5 w-5 text-primary-500 mr-2" />
                            <h4 className="text-lg font-semibold text-primary-800 dark:text-primary-200">
                              Contract Details
                            </h4>
                          </div>
                          {(() => {
                            const selectedContract = contracts.find(c => c.id === parseInt(formData.contractId))
                            return selectedContract ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div>
                                  <p className="text-primary-700 dark:text-primary-300 font-medium">
                                    {selectedContract.title}
                                  </p>
                                  <p className="text-primary-600 dark:text-primary-400 mt-1">
                                    {selectedContract.description}
                                  </p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-primary-600 dark:text-primary-400">
                                    <span className="font-medium">Period:</span> {selectedContract.startDate ? new Date(selectedContract.startDate).toLocaleDateString() : 'N/A'} - {selectedContract.endDate ? new Date(selectedContract.endDate).toLocaleDateString() : 'N/A'}
                                  </p>
                                  <p className="text-primary-600 dark:text-primary-400">
                                    <span className="font-medium">Total Value:</span> ${(selectedContract.totalValue || 0).toLocaleString()}
                                  </p>
                                  <p className="text-primary-600 dark:text-primary-400">
                                    <span className="font-medium">Hourly Rate:</span> ${selectedContract.hourlyRate || 0}/hr
                                  </p>
                                  <p className="text-primary-600 dark:text-primary-400">
                                    <span className="font-medium">Estimated Hours:</span> {selectedContract.estimatedHours || 0} hrs
                                  </p>
                                </div>
                              </div>
                            ) : null
                          })()}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Client Selection */}
                  <div>
                    <label className={combineThemeClasses("block text-sm font-medium mb-2", themeClasses.form.label)}>
                      Client <span className="text-error-500">*</span>
                    </label>
                    <select
                      required
                      className={combineThemeClasses("w-full", themeClasses.input)}
                      value={formData.clientName || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, clientName: e.target.value }))}
                    >
                      <option value="">Choose a client...</option>
                      {availableClients.map(client => (
                        <option key={client.id} value={client.name}>
                          {client.name} - {client.company}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Due Date */}
                  <div>
                    <label className={combineThemeClasses("block text-sm font-medium mb-2", themeClasses.form.label)}>
                      Due Date <span className="text-error-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      className={combineThemeClasses("w-full", themeClasses.input)}
                      value={formData.dueDate || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                    />
                  </div>

                  {/* Status */}
                  <div>
                    <label className={combineThemeClasses("block text-sm font-medium mb-2", themeClasses.form.label)}>
                      Status
                    </label>
                    <select
                      className={combineThemeClasses("w-full", themeClasses.input)}
                      value={formData.status || 'pending'}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    >
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                      <option value="overdue">Overdue</option>
                    </select>
                  </div>

                  {/* Description */}
                  <div>
                    <label className={combineThemeClasses("block text-sm font-medium mb-2", themeClasses.form.label)}>
                      Description
                    </label>
                    <textarea
                      rows={3}
                      className={combineThemeClasses("w-full", themeClasses.input)}
                      value={formData.description || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Enter invoice description..."
                    />
                  </div>
                </div>

                {/* Right Column - Line Items */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-medium text-text-primary dark:text-white">
                      Line Items
                    </h4>
                    <button
                      type="button"
                      onClick={addLineItem}
                      className="btn btn-primary text-sm"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Item
                    </button>
                  </div>

                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {formData.lineItems.map((item, index) => (
                      <div key={index} className="p-4 border border-text-muted rounded-lg dark:border-gray-600">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-medium text-text-secondary dark:text-gray-400 mb-1">
                              Description
                            </label>
                            <input
                              type="text"
                              className={combineThemeClasses("w-full text-sm", themeClasses.input)}
                              value={item.description || ''}
                              onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                              placeholder="Item description..."
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-text-secondary dark:text-gray-400 mb-1">
                              Qty
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              className={combineThemeClasses("w-full text-sm", themeClasses.input)}
                              value={item.quantity || ''}
                              onChange={(e) => updateLineItem(index, 'quantity', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-text-secondary dark:text-gray-400 mb-1">
                              Rate
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              className={combineThemeClasses("w-full text-sm", themeClasses.input)}
                              value={item.rate || ''}
                              onChange={(e) => updateLineItem(index, 'rate', e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <div className="text-sm font-medium text-text-primary dark:text-white">
                            Amount: ${(parseFloat(item.amount) || 0).toFixed(2)}
                          </div>
                          {formData.lineItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeLineItem(index)}
                              className="text-error-500 hover:text-error-700 dark:text-error-400 dark:hover:text-error-300"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="border-t border-text-muted dark:border-gray-600 pt-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-text-secondary dark:text-gray-400">Subtotal:</span>
                        <span className="text-text-primary dark:text-white">${(parseFloat(formData.subtotal) || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center space-x-2">
                          <span className="text-text-secondary dark:text-gray-400">Tax:</span>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            className="w-16 px-2 py-1 text-xs border border-text-muted rounded dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            value={formData.taxPercentage || 0}
                            onChange={(e) => setFormData(prev => ({ ...prev, taxPercentage: parseFloat(e.target.value) || 0 }))}
                          />
                          <span className="text-text-secondary dark:text-gray-400">%</span>
                        </div>
                        <span className="text-text-primary dark:text-white">${(parseFloat(formData.tax) || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold border-t border-text-muted dark:border-gray-600 pt-2">
                        <span className="text-text-primary dark:text-white">Total:</span>
                        <span className="text-primary-500">${(parseFloat(formData.total) || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={combineThemeClasses("px-6 py-4 flex justify-end space-x-3", themeClasses.modal.footer)}>
              <button
                type="button"
                onClick={onClose}
                className={combineThemeClasses("btn btn-secondary", themeClasses.button.secondary)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={combineThemeClasses("btn btn-primary", themeClasses.button.primary)}
              >
                {editingInvoice ? 'Update Invoice' : 'Create Invoice'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
})

InvoiceModal.displayName = 'InvoiceModal'

export default InvoiceModal

