import React, { memo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { themeClasses, combineThemeClasses } from '../styles/theme'
import { 
  X, 
  Building2, 
  Calendar, 
  DollarSign, 
  Clock, 
  User,
  ArrowRight
} from 'lucide-react'
import { format } from 'date-fns'

const ContractDetailsModal = memo(({ contract, isOpen, onClose }) => {
  const { theme } = useTheme()
  const navigate = useNavigate()

  if (!isOpen || !contract) return null

  const handleViewContract = useCallback(() => {
    navigate('/contracts', { state: { highlightContractId: contract.id } })
    onClose()
  }, [navigate, contract.id, onClose])

  const getStatusColor = useCallback((status) => {
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
  }, [])

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className={combineThemeClasses("flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0", themeClasses.modal.overlay)}>
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        <div className="inline-block transform overflow-hidden rounded-2xl bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:align-middle dark:bg-gray-800">
          <div className={combineThemeClasses("px-6 pt-6 pb-4", themeClasses.modal.header)}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <Building2 className="h-8 w-8 text-primary-500 mr-3" />
                <div>
                  <h3 className="text-2xl font-bold text-text-primary dark:text-white">
                    Contract Details
                  </h3>
                  <p className="text-sm text-text-secondary dark:text-gray-400">
                    UID: {contract.uid}
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
              {/* Contract Header */}
              <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-6 border border-primary-200 dark:border-primary-800">
                <h4 className="text-xl font-semibold text-primary-800 dark:text-primary-200 mb-2">
                  {contract.title}
                </h4>
                <p className="text-primary-600 dark:text-primary-400">
                  {contract.description}
                </p>
                <div className="mt-4 flex items-center">
                  <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(contract.status)}`}>
                    {contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}
                  </span>
                </div>
              </div>

              {/* Contract Information Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Client Information */}
                <div className="space-y-4">
                  <div className="flex items-center">
                    <User className="h-5 w-5 text-text-muted mr-3" />
                    <div>
                      <p className="text-sm text-text-secondary dark:text-gray-400">Client</p>
                      <p className="text-text-primary dark:text-white font-medium">{contract.clientName}</p>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <Calendar className="h-5 w-5 text-text-muted mr-3" />
                    <div>
                      <p className="text-sm text-text-secondary dark:text-gray-400">Project Period</p>
                      <p className="text-text-primary dark:text-white font-medium">
                        {format(new Date(contract.startDate), 'MMM dd, yyyy')} - {format(new Date(contract.endDate), 'MMM dd, yyyy')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Financial Information */}
                <div className="space-y-4">
                  <div className="flex items-center">
                    <DollarSign className="h-5 w-5 text-text-muted mr-3" />
                    <div>
                      <p className="text-sm text-text-secondary dark:text-gray-400">Total Value</p>
                      <p className="text-text-primary dark:text-white font-medium text-lg">
                        ${(contract.totalValue || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <Clock className="h-5 w-5 text-text-muted mr-3" />
                    <div>
                      <p className="text-sm text-text-secondary dark:text-gray-400">Hourly Rate</p>
                      <p className="text-text-primary dark:text-white font-medium">
                        ${contract.hourlyRate || 0}/hr
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Details */}
              <div className="bg-bg-secondary dark:bg-gray-700 rounded-xl p-6">
                <h5 className="text-lg font-semibold text-text-primary dark:text-white mb-4">
                  Project Details
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-text-secondary dark:text-gray-400">Estimated Hours</p>
                    <p className="text-text-primary dark:text-white font-medium">
                      {contract.estimatedHours || 0} hours
                    </p>
                  </div>
                  <div>
                    <p className="text-text-secondary dark:text-gray-400">Created</p>
                    <p className="text-text-primary dark:text-white font-medium">
                      {contract.createdAt ? format(new Date(contract.createdAt), 'MMM dd, yyyy') : 'N/A'}
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
            <button
              onClick={handleViewContract}
              className={combineThemeClasses("btn btn-primary flex items-center", themeClasses.button.primary)}
            >
              View in Contracts
              <ArrowRight className="h-4 w-4 ml-2" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})

ContractDetailsModal.displayName = 'ContractDetailsModal'

export default ContractDetailsModal

