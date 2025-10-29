import React, { memo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { themeClasses, combineThemeClasses } from '../styles/theme'
import { 
  X, 
  FileText, 
  Building2, 
  DollarSign, 
  Calendar,
  ArrowRight
} from 'lucide-react'
import { format } from 'date-fns'

const InvoiceListModal = memo(({ invoices, contract, isOpen, onClose }) => {
  const { theme } = useTheme()
  const navigate = useNavigate()

  if (!isOpen || !contract) return null

  const handleViewInvoice = useCallback((invoice) => {
    navigate('/invoices', { state: { highlightInvoiceId: invoice.id } })
    onClose()
  }, [navigate, onClose])

  const handleViewAllInvoices = useCallback(() => {
    navigate('/invoices')
    onClose()
  }, [navigate, onClose])

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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className={combineThemeClasses("flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0", themeClasses.modal.overlay)}>
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        <div className="inline-block transform overflow-hidden rounded-2xl bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl sm:align-middle dark:bg-gray-800">
          <div className={combineThemeClasses("px-6 pt-6 pb-4", themeClasses.modal.header)}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <Building2 className="h-8 w-8 text-primary-500 mr-3" />
                <div>
                  <h3 className="text-2xl font-bold text-text-primary dark:text-white">
                    Contract Invoices
                  </h3>
                  <p className="text-sm text-text-secondary dark:text-gray-400">
                    {contract.title} - {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-text-muted hover:text-text-primary dark:text-gray-400 dark:hover:text-white transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Invoices List */}
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="border border-text-muted dark:border-gray-600 rounded-xl p-4 hover:bg-bg-secondary dark:hover:bg-gray-700 transition-colors cursor-pointer"
                  onClick={() => handleViewInvoice(invoice)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center">
                        <FileText className="h-5 w-5 text-primary-500 mr-2" />
                        <div>
                          <p className="text-text-primary dark:text-white font-medium">
                            {invoice.invoiceNumber || `#${invoice.id}`}
                          </p>
                          <p className="text-sm text-text-secondary dark:text-gray-400">
                            {invoice.description}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-text-primary dark:text-white font-medium">
                          ${(invoice.amount || 0).toLocaleString()}
                        </p>
                        <p className="text-sm text-text-secondary dark:text-gray-400">
                          Due: {invoice.dueDate ? format(new Date(invoice.dueDate), 'MMM dd, yyyy') : 'N/A'}
                        </p>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(invoice.status || 'pending')}`}>
                          {invoice.status || 'pending'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {invoices.length === 0 && (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-text-muted dark:text-gray-500 mx-auto mb-4" />
                  <p className="text-text-secondary dark:text-gray-400">
                    No invoices found for this contract.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className={combineThemeClasses("px-6 py-4 flex justify-end space-x-3", themeClasses.modal.footer)}>
            <button
              onClick={onClose}
              className={combineThemeClasses("btn btn-secondary", themeClasses.button.secondary)}
            >
              Close
            </button>
            {invoices.length > 0 && (
              <button
                onClick={handleViewAllInvoices}
                className={combineThemeClasses("btn btn-primary flex items-center", themeClasses.button.primary)}
              >
                View All Invoices
                <ArrowRight className="h-4 w-4 ml-2" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})

InvoiceListModal.displayName = 'InvoiceListModal'

export default InvoiceListModal
