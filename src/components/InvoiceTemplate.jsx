import React from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { format } from 'date-fns'

const InvoiceTemplate = ({ invoice, onClose }) => {
  const { user } = useAuth()
  const { clients, contracts } = useData()

  const client = clients.find(c => c.name === invoice.clientName)
  const contract = invoice.contractId ? contracts.find(c => c.id === invoice.contractId) : null

  const handlePrint = () => {
    window.print()
  }

  const handleDownload = () => {
    // In a real app, this would generate a PDF
    alert('PDF download functionality would be implemented here')
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-100 dark:bg-gray-900">
      <div className="min-h-screen px-4 py-6">
        <div className="mx-auto max-w-4xl">
          {/* Header with actions */}
          <div className="mb-6 flex justify-between items-center">
            <button
              onClick={onClose}
              className="btn btn-secondary"
            >
              ← Back to Invoices
            </button>
            <div className="flex space-x-3">
              <button
                onClick={handlePrint}
                className="btn btn-secondary"
              >
                Print
              </button>
              <button
                onClick={handleDownload}
                className="btn btn-primary"
              >
                Download PDF
              </button>
            </div>
          </div>

          {/* Invoice Template */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden print:shadow-none">
            {/* LoomLance Header */}
            <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white p-8 print:bg-primary-500">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center mb-4">
                    <img 
                      src="/logo.png" 
                      alt="LoomLance Logo" 
                      className="h-16 w-16 object-contain mr-4"
                    />
                    <div>
                      <h1 className="text-4xl font-bold">
                        <span className="text-white">Loom</span>
                        <span className="text-primary-200">Lance</span>
                      </h1>
                      <p className="text-primary-100 text-lg">Developer-First Freelance Management</p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <h2 className="text-3xl font-bold mb-2">INVOICE</h2>
                  <p className="text-primary-100">{invoice.invoiceNumber || `#${invoice.id}`}</p>
                </div>
              </div>
            </div>

            {/* Invoice Details */}
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                {/* From (User) Details */}
                <div>
                  <h3 className="text-lg font-semibold text-text-primary dark:text-white mb-4">From:</h3>
                  <div className="space-y-2">
                    <p className="text-text-primary dark:text-white font-medium">{user?.name || 'Your Name'}</p>
                    <p className="text-text-secondary dark:text-gray-400">{user?.company || 'Your Company'}</p>
                    <p className="text-text-secondary dark:text-gray-400">{user?.email || 'your.email@example.com'}</p>
                    <p className="text-text-secondary dark:text-gray-400">{user?.phone || '+1 (555) 123-4567'}</p>
                    <p className="text-text-secondary dark:text-gray-400">{user?.address || 'Your Address'}</p>
                  </div>
                </div>

                {/* To (Client) Details */}
                <div>
                  <h3 className="text-lg font-semibold text-text-primary dark:text-white mb-4">To:</h3>
                  <div className="space-y-2">
                    <p className="text-text-primary dark:text-white font-medium">{invoice.clientName}</p>
                    {client && (
                      <>
                        <p className="text-text-secondary dark:text-gray-400">{client.company}</p>
                        <p className="text-text-secondary dark:text-gray-400">{client.email}</p>
                        <p className="text-text-secondary dark:text-gray-400">{client.phone}</p>
                        <p className="text-text-secondary dark:text-gray-400">{client.address}</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Invoice Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 p-6 bg-bg-secondary dark:bg-gray-700 rounded-xl">
                <div>
                  <p className="text-sm text-text-secondary dark:text-gray-400 mb-1">Invoice Date</p>
                  <p className="text-text-primary dark:text-white font-medium">
                    {format(new Date(invoice.createdAt), 'MMM dd, yyyy')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-text-secondary dark:text-gray-400 mb-1">Due Date</p>
                  <p className="text-text-primary dark:text-white font-medium">
                    {format(new Date(invoice.dueDate), 'MMM dd, yyyy')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-text-secondary dark:text-gray-400 mb-1">Status</p>
                  <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                    invoice.status === 'paid' 
                      ? 'bg-success-50 text-success-600 dark:bg-success-900 dark:text-success-300'
                      : invoice.status === 'pending'
                      ? 'bg-warning-50 text-warning-600 dark:bg-warning-900 dark:text-warning-300'
                      : 'bg-error-50 text-error-600 dark:bg-error-900 dark:text-error-300'
                  }`}>
                    {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                  </span>
                </div>
              </div>

              {/* Contract Reference */}
              {contract && (
                <div className="mb-8 p-6 bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-200 dark:border-primary-800">
                  <div className="flex items-center mb-3">
                    <div className="h-2 w-2 bg-primary-500 rounded-full mr-3"></div>
                    <h4 className="text-lg font-semibold text-primary-800 dark:text-primary-200">
                      Associated Contract
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-primary-700 dark:text-primary-300 font-medium">
                        {contract.title}
                      </p>
                      <p className="text-sm text-primary-600 dark:text-primary-400 mt-1">
                        {contract.description}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-primary-600 dark:text-primary-400">
                        Period: {format(new Date(contract.startDate), 'MMM dd, yyyy')} - {format(new Date(contract.endDate), 'MMM dd, yyyy')}
                      </p>
                      <p className="text-sm text-primary-600 dark:text-primary-400">
                        Status: <span className="font-medium capitalize">{contract.status}</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Description */}
              {invoice.description && (
                <div className="mb-8">
                  <h4 className="text-lg font-semibold text-text-primary dark:text-white mb-2">
                    Description
                  </h4>
                  <p className="text-text-secondary dark:text-gray-400">{invoice.description}</p>
                </div>
              )}

              {/* Line Items Table */}
              <div className="mb-8">
                <h4 className="text-lg font-semibold text-text-primary dark:text-white mb-4">
                  Services Provided
                </h4>
                <div className="overflow-hidden border border-text-muted dark:border-gray-600 rounded-xl">
                  <table className="min-w-full divide-y divide-text-muted dark:divide-gray-600">
                    <thead className="bg-bg-secondary dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary dark:text-gray-400 uppercase tracking-wider">
                          Description
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary dark:text-gray-400 uppercase tracking-wider">
                          Quantity
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary dark:text-gray-400 uppercase tracking-wider">
                          Rate
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary dark:text-gray-400 uppercase tracking-wider">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-text-muted dark:divide-gray-600">
                      {invoice.lineItems && Array.isArray(invoice.lineItems) && invoice.lineItems.map((item, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 text-sm text-text-primary dark:text-white">
                            {item.description || 'No description'}
                          </td>
                          <td className="px-6 py-4 text-sm text-text-primary dark:text-white text-right">
                            {item.quantity || 0}
                          </td>
                          <td className="px-6 py-4 text-sm text-text-primary dark:text-white text-right">
                            ${(item.rate || 0).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-sm text-text-primary dark:text-white text-right font-medium">
                            ${(item.amount || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-64">
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary dark:text-gray-400">Subtotal:</span>
                      <span className="text-text-primary dark:text-white">${invoice.subtotal?.toFixed(2) || invoice.amount.toFixed(2)}</span>
                    </div>
                    {invoice.tax > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-text-secondary dark:text-gray-400">
                          Tax {invoice.taxPercentage ? `(${invoice.taxPercentage}%)` : ''}:
                        </span>
                        <span className="text-text-primary dark:text-white">${invoice.tax.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold border-t border-text-muted dark:border-gray-600 pt-3">
                      <span className="text-text-primary dark:text-white">Total:</span>
                      <span className="text-primary-500">${invoice.total?.toFixed(2) || invoice.amount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Instructions */}
              <div className="mt-12 p-6 bg-bg-secondary dark:bg-gray-700 rounded-xl">
                <h4 className="text-lg font-semibold text-text-primary dark:text-white mb-3">
                  Payment Instructions
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-text-secondary dark:text-gray-400 mb-2">Bank Transfer:</p>
                    <p className="text-text-primary dark:text-white text-sm">
                      Account: ****1234<br />
                      Routing: 123456789<br />
                      Bank: Your Bank Name
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary dark:text-gray-400 mb-2">Online Payment:</p>
                    <p className="text-text-primary dark:text-white text-sm">
                      PayPal: your.email@example.com<br />
                      Stripe: Available upon request
                    </p>
                  </div>
                </div>
                <p className="text-sm text-text-secondary dark:text-gray-400 mt-4">
                  Please include invoice number {invoice.invoiceNumber || `#${invoice.id}`} in your payment reference.
                </p>
              </div>

              {/* Footer */}
              <div className="mt-12 text-center text-sm text-text-secondary dark:text-gray-400">
                <p>Thank you for your business!</p>
                <p className="mt-2">
                  Questions? Contact us at {user?.email || 'your.email@example.com'} or {user?.phone || '+1 (555) 123-4567'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default InvoiceTemplate

