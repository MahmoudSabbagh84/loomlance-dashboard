import React from 'react'
import { useTheme } from '../context/ThemeContext'
import { themeClasses, combineThemeClasses } from '../styles/theme'
import { 
  X, 
  FileText, 
  Building2, 
  DollarSign, 
  Calendar, 
  User,
  ArrowRight
} from 'lucide-react'
import { format } from 'date-fns'

const InvoiceDetailsModal = ({ invoice, isOpen, onClose, onViewInInvoices }) => {
  const { theme } = useTheme()

  if (!isOpen || !invoice) return null

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
    <div className="fixed inset-0 z-60 overflow-y-auto">
      <div className={combineThemeClasses("flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0", themeClasses.modal.overlay)}>
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        <div className="inline-block transform overflow-hidden rounded-2xl bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-3xl sm:align-middle dark:bg-gray-800">
          <div className={combineThemeClasses("px-6 pt-6 pb-4", themeClasses.modal.header)}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <FileText className="h-8 w-8 text-primary-500 mr-3" />
                <div>
                  <h3 className="text-2xl font-bold text-text-primary dark:text-white">
                    Invoice Details
                  </h3>
                  <p className="text-sm text-text-secondary dark:text-gray-400">
                    {invoice.invoiceNumber || `#${invoice.id}`} • UID: {invoice.uid}
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

            <div className="space-y-6">
              {/* Invoice Header */}
              <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-6 border border-primary-200 dark:border-primary-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xl font-semibold text-primary-800 dark:text-primary-200 mb-2">
                      {invoice.description || 'Invoice'}
                    </h4>
                    <p className="text-primary-600 dark:text-primary-400">
                      Client: {invoice.clientName || 'Unknown Client'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary-800 dark:text-primary-200">
                      ${(invoice.amount || 0).toLocaleString()}
                    </p>
                    <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(invoice.status || 'pending')}`}>
                      {invoice.status || 'pending'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Invoice Information Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Client Information */}
                <div className="space-y-4">
                  <div className="flex items-center">
                    <User className="h-5 w-5 text-text-muted mr-3" />
                    <div>
                      <p className="text-sm text-text-secondary dark:text-gray-400">Client</p>
                      <p className="text-text-primary dark:text-white font-medium">{invoice.clientName || 'Unknown Client'}</p>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <Calendar className="h-5 w-5 text-text-muted mr-3" />
                    <div>
                      <p className="text-sm text-text-secondary dark:text-gray-400">Due Date</p>
                      <p className="text-text-primary dark:text-white font-medium">
                        {invoice.dueDate ? format(new Date(invoice.dueDate), 'MMM dd, yyyy') : 'N/A'}
                      </p>
                    </div>
                  </div>

                  {(invoice.type || 'standalone') === 'contract-based' && (
                    <div className="flex items-center">
                      <Building2 className="h-5 w-5 text-text-muted mr-3" />
                      <div>
                        <p className="text-sm text-text-secondary dark:text-gray-400">Contract Based</p>
                        <p className="text-text-primary dark:text-white font-medium">Yes</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Financial Information */}
                <div className="space-y-4">
                  <div className="flex items-center">
                    <DollarSign className="h-5 w-5 text-text-muted mr-3" />
                    <div>
                      <p className="text-sm text-text-secondary dark:text-gray-400">Total Amount</p>
                      <p className="text-text-primary dark:text-white font-medium text-lg">
                        ${(invoice.amount || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {invoice.subtotal && (
                    <div className="flex items-center">
                      <FileText className="h-5 w-5 text-text-muted mr-3" />
                      <div>
                        <p className="text-sm text-text-secondary dark:text-gray-400">Subtotal</p>
                        <p className="text-text-primary dark:text-white font-medium">
                          ${invoice.subtotal.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  )}

                  {invoice.tax > 0 && (
                    <div className="flex items-center">
                      <FileText className="h-5 w-5 text-text-muted mr-3" />
                      <div>
                        <p className="text-sm text-text-secondary dark:text-gray-400">Tax ({invoice.taxPercentage}%)</p>
                        <p className="text-text-primary dark:text-white font-medium">
                          ${invoice.tax.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Line Items */}
              {invoice.lineItems && Array.isArray(invoice.lineItems) && invoice.lineItems.length > 0 && (
                <div className="bg-bg-secondary dark:bg-gray-700 rounded-xl p-6">
                  <h5 className="text-lg font-semibold text-text-primary dark:text-white mb-4">
                    Line Items
                  </h5>
                  <div className="space-y-3">
                    {invoice.lineItems.map((item, index) => (
                      <div key={index} className="flex justify-between items-center py-2 border-b border-text-muted dark:border-gray-600 last:border-b-0">
                        <div>
                          <p className="text-text-primary dark:text-white font-medium">{item.description || 'No description'}</p>
                          <p className="text-sm text-text-secondary dark:text-gray-400">
                            {item.quantity || 0} × ${(item.rate || 0).toFixed(2)}
                          </p>
                        </div>
                        <p className="text-text-primary dark:text-white font-medium">
                          ${(item.amount || 0).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional Details */}
              <div className="bg-bg-secondary dark:bg-gray-700 rounded-xl p-6">
                <h5 className="text-lg font-semibold text-text-primary dark:text-white mb-4">
                  Additional Details
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-text-secondary dark:text-gray-400">Invoice Type</p>
                    <p className="text-text-primary dark:text-white font-medium">
                      {(invoice.type || 'standalone') === 'contract-based' ? 'Contract Based' : 'Standalone'}
                    </p>
                  </div>
                  <div>
                    <p className="text-text-secondary dark:text-gray-400">Created</p>
                    <p className="text-text-primary dark:text-white font-medium">
                      {invoice.createdAt ? format(new Date(invoice.createdAt), 'MMM dd, yyyy') : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={combineThemeClasses("px-6 py-4 flex justify-end space-x-3", themeClasses.modal.footer)}>
            <button
              onClick={onClose}
              className={combineThemeClasses("btn btn-secondary", themeClasses.button.secondary)}
            >
              Close
            </button>
            {onViewInInvoices && (
              <button
                onClick={onViewInInvoices}
                className={combineThemeClasses("btn btn-primary flex items-center", themeClasses.button.primary)}
              >
                View in Invoices
                <ArrowRight className="h-4 w-4 ml-2" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default InvoiceDetailsModal
