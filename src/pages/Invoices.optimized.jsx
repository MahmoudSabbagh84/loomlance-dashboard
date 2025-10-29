import React, { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { useTheme } from '../context/ThemeContext'
import { themeClasses, combineThemeClasses } from '../styles/theme'
import InvoiceModal from '../components/InvoiceModal'
import InvoiceTemplate from '../components/InvoiceTemplate'
import InvoiceDetailsModal from '../components/InvoiceDetailsModal'
import ContractDetailsModal from '../components/ContractDetailsModal'
import ArchiveButton from '../components/ArchiveButton'
import { 
  StatusBadge, 
  CurrencyDisplay, 
  DateDisplay, 
  ActionButton, 
  TableRow,
  EmptyState 
} from '../components/OptimizedComponents'
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

// Memoized Invoice Row Component
const InvoiceRow = memo(({ 
  invoice, 
  onEdit, 
  onDelete, 
  onView, 
  onMarkPaid, 
  onMarkPending, 
  onRowClick,
  highlightedInvoiceId 
}) => {
  const { theme } = useTheme()
  
  const handleActionClick = useCallback((e, action) => {
    e.stopPropagation()
    action()
  }, [])

  const getStatusIcon = useCallback((status) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="h-4 w-4" />
      case 'pending':
        return <Clock className="h-4 w-4" />
      case 'overdue':
        return <AlertCircle className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }, [])

  const isHighlighted = highlightedInvoiceId === invoice.id

  return (
    <TableRow
      onClick={() => onRowClick(invoice)}
      isClickable={true}
      className={`${isHighlighted ? 'ring-2 ring-orange-500 bg-orange-50 dark:bg-orange-900/20' : ''}`}
    >
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
        <div className="flex items-center">
          <FileText className="h-5 w-5 text-gray-400 mr-3" />
          <div>
            <div className="font-medium">{invoice.invoiceNumber || `#${invoice.id}`}</div>
            <div className="text-gray-500 dark:text-gray-400">{invoice.clientName}</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <CurrencyDisplay amount={invoice.amount} className="text-sm font-medium" />
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <DateDisplay date={invoice.dueDate} className="text-sm" />
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          {getStatusIcon(invoice.status)}
          <StatusBadge status={invoice.status} className="ml-2" />
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
        {invoice.contractUid ? (
          <div className="flex items-center">
            <Building2 className="h-4 w-4 mr-1" />
            <span>Contract</span>
          </div>
        ) : (
          <span>Standalone</span>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="flex items-center justify-end space-x-2">
          {invoice.status === 'pending' && (
            <ActionButton
              onClick={(e) => handleActionClick(e, onMarkPaid)}
              icon={CheckCheck}
              title="Mark as Paid"
              variant="success"
            />
          )}
          {invoice.status === 'paid' && (
            <ActionButton
              onClick={(e) => handleActionClick(e, onMarkPending)}
              icon={Clock}
              title="Mark as Pending"
              variant="warning"
            />
          )}
          <ActionButton
            onClick={(e) => handleActionClick(e, onView)}
            icon={Eye}
            title="View Invoice"
            variant="default"
          />
          <ActionButton
            onClick={(e) => handleActionClick(e, onEdit)}
            icon={Edit}
            title="Edit Invoice"
            variant="primary"
          />
          <ActionButton
            onClick={(e) => handleActionClick(e, onDelete)}
            icon={Trash2}
            title="Delete Invoice"
            variant="danger"
          />
        </div>
      </td>
    </TableRow>
  )
})

InvoiceRow.displayName = 'InvoiceRow'

// Memoized Invoice Table Component
const InvoiceTable = memo(({ 
  invoices, 
  onEdit, 
  onDelete, 
  onView, 
  onMarkPaid, 
  onMarkPending, 
  onRowClick,
  highlightedInvoiceId 
}) => {
  const { theme } = useTheme()

  if (invoices.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No invoices found"
        description="Get started by creating your first invoice."
      />
    )
  }

  return (
    <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
      <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
        <thead className={combineThemeClasses("bg-gray-50 dark:bg-gray-700", themeClasses.table.header)}>
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Invoice
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
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Type
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className={combineThemeClasses("bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600", themeClasses.table.body)}>
          {invoices.map((invoice) => (
            <InvoiceRow
              key={invoice.id}
              invoice={invoice}
              onEdit={() => onEdit(invoice)}
              onDelete={() => onDelete(invoice)}
              onView={() => onView(invoice)}
              onMarkPaid={() => onMarkPaid(invoice)}
              onMarkPending={() => onMarkPending(invoice)}
              onRowClick={onRowClick}
              highlightedInvoiceId={highlightedInvoiceId}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
})

InvoiceTable.displayName = 'InvoiceTable'

// Main Invoices Component
const Invoices = () => {
  const { 
    invoices, 
    addInvoice, 
    updateInvoice, 
    deleteInvoice, 
    markInvoiceAsPaid, 
    markInvoiceAsPending, 
    markAllInvoicesAsPaid, 
    contracts, 
    archiveInvoice 
  } = useData()
  const { theme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()

  // State
  const [showModal, setShowModal] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState(null)
  const [viewingInvoice, setViewingInvoice] = useState(null)
  const [viewingDetails, setViewingDetails] = useState(null)
  const [showContractDetails, setShowContractDetails] = useState(false)
  const [selectedContract, setSelectedContract] = useState(null)
  const [highlightedInvoiceId, setHighlightedInvoiceId] = useState(null)

  // Memoized filtered invoices
  const filteredInvoices = useMemo(() => {
    const searchParams = new URLSearchParams(location.search)
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    
    let filtered = invoices
    
    if (status && status !== 'all') {
      filtered = filtered.filter(invoice => invoice.status === status)
    }
    
    if (search) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter(invoice => 
        invoice.invoiceNumber?.toLowerCase().includes(searchLower) ||
        invoice.clientName?.toLowerCase().includes(searchLower) ||
        invoice.description?.toLowerCase().includes(searchLower)
      )
    }
    
    return filtered
  }, [invoices, location.search])

  // Memoized statistics
  const stats = useMemo(() => {
    const total = invoices.length
    const paid = invoices.filter(inv => inv.status === 'paid').length
    const pending = invoices.filter(inv => inv.status === 'pending').length
    const overdue = invoices.filter(inv => inv.status === 'overdue').length
    const totalAmount = invoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0)
    const paidAmount = invoices
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0)

    return { total, paid, pending, overdue, totalAmount, paidAmount }
  }, [invoices])

  // Optimized event handlers
  const handleAddInvoice = useCallback(() => {
    setEditingInvoice(null)
    setShowModal(true)
  }, [])

  const handleEdit = useCallback((invoice) => {
    setEditingInvoice(invoice)
    setShowModal(true)
  }, [])

  const handleDelete = useCallback((invoice) => {
    if (window.confirm(`Are you sure you want to delete invoice ${invoice.invoiceNumber || `#${invoice.id}`}?`)) {
      deleteInvoice(invoice.id)
    }
  }, [deleteInvoice])

  const handleView = useCallback((invoice) => {
    setViewingInvoice(invoice)
  }, [])

  const handleRowClick = useCallback((invoice) => {
    // Remove focus from any active elements to prevent header styling issues
    if (document.activeElement) {
      document.activeElement.blur()
    }
    setViewingDetails(invoice)
  }, [])

  const handleMarkPaid = useCallback((invoice) => {
    markInvoiceAsPaid(invoice.id)
  }, [markInvoiceAsPaid])

  const handleMarkPending = useCallback((invoice) => {
    markInvoiceAsPending(invoice.id)
  }, [markInvoiceAsPending])

  const handleSave = useCallback((invoiceData) => {
    if (editingInvoice) {
      updateInvoice({ ...invoiceData, id: editingInvoice.id })
    } else {
      addInvoice(invoiceData)
    }
    setShowModal(false)
    setEditingInvoice(null)
  }, [editingInvoice, updateInvoice, addInvoice])

  const handleCloseModal = useCallback(() => {
    setShowModal(false)
    setEditingInvoice(null)
  }, [])

  const handleCloseView = useCallback(() => {
    setViewingInvoice(null)
  }, [])

  const handleCloseDetails = useCallback(() => {
    setViewingDetails(null)
  }, [])

  const handleArchiveSelected = useCallback((invoicesToArchive) => {
    invoicesToArchive.forEach(invoice => archiveInvoice(invoice.id))
  }, [archiveInvoice])

  const handleArchiveAll = useCallback((invoicesToArchive) => {
    invoicesToArchive.forEach(invoice => archiveInvoice(invoice.id))
  }, [archiveInvoice])

  // Highlight invoice from URL
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    const invoiceId = searchParams.get('highlight')
    if (invoiceId) {
      setHighlightedInvoiceId(parseInt(invoiceId))
      // Clear highlight after 3 seconds
      setTimeout(() => setHighlightedInvoiceId(null), 3000)
    }
  }, [location.search])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary dark:text-white">Invoices</h1>
          <p className="text-text-secondary dark:text-gray-300">
            Manage your invoices and track payments
          </p>
        </div>
        <div className="flex space-x-3">
          <ArchiveButton
            items={invoices}
            onArchiveSelected={handleArchiveSelected}
            onArchiveAll={handleArchiveAll}
            archiveAllLabel="Archive All Paid"
            archiveSelectedLabel="Archive Selected"
            archiveAllCondition={(invoice) => invoice.status === 'paid'}
            archiveSelectedCondition={(invoice) => invoice.status === 'paid'}
          />
          <button
            onClick={handleAddInvoice}
            className={combineThemeClasses("btn btn-primary", themeClasses.button.primary)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Invoice
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={combineThemeClasses("p-4 rounded-lg", themeClasses.card)}>
          <div className="flex items-center">
            <FileText className="h-8 w-8 text-primary-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-text-secondary dark:text-gray-400">Total Invoices</p>
              <p className="text-2xl font-bold text-text-primary dark:text-white">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className={combineThemeClasses("p-4 rounded-lg", themeClasses.card)}>
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-success-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-text-secondary dark:text-gray-400">Paid</p>
              <p className="text-2xl font-bold text-text-primary dark:text-white">{stats.paid}</p>
            </div>
          </div>
        </div>
        <div className={combineThemeClasses("p-4 rounded-lg", themeClasses.card)}>
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-warning-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-text-secondary dark:text-gray-400">Pending</p>
              <p className="text-2xl font-bold text-text-primary dark:text-white">{stats.pending}</p>
            </div>
          </div>
        </div>
        <div className={combineThemeClasses("p-4 rounded-lg", themeClasses.card)}>
          <div className="flex items-center">
            <AlertCircle className="h-8 w-8 text-error-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-text-secondary dark:text-gray-400">Overdue</p>
              <p className="text-2xl font-bold text-text-primary dark:text-white">{stats.overdue}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Table */}
      <InvoiceTable
        invoices={filteredInvoices}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onView={handleView}
        onMarkPaid={handleMarkPaid}
        onMarkPending={handleMarkPending}
        onRowClick={handleRowClick}
        highlightedInvoiceId={highlightedInvoiceId}
      />

      {/* Modals */}
      <InvoiceModal
        isOpen={showModal}
        onClose={handleCloseModal}
        editingInvoice={editingInvoice}
        onSave={handleSave}
      />

      <InvoiceTemplate
        invoice={viewingInvoice}
        isOpen={!!viewingInvoice}
        onClose={handleCloseView}
      />

      <InvoiceDetailsModal
        invoice={viewingDetails}
        isOpen={!!viewingDetails}
        onClose={handleCloseDetails}
        onViewInInvoices={() => {
          setViewingDetails(null)
          navigate('/invoices')
        }}
      />

      <ContractDetailsModal
        contract={selectedContract}
        isOpen={showContractDetails}
        onClose={() => setShowContractDetails(false)}
      />
    </div>
  )
}

export default memo(Invoices)
