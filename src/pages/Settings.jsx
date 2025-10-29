import React from 'react'
import { useSettings } from '../context/SettingsContext'
import { useTheme } from '../context/ThemeContext'
import { themeClasses, combineThemeClasses } from '../styles/theme'
import { Settings as SettingsIcon, FileText, DollarSign } from 'lucide-react'

const Settings = () => {
  const { invoiceBilledDisplay, updateInvoiceBilledDisplay } = useSettings()
  const { theme } = useTheme()

  const handleInvoiceBilledDisplayChange = (value) => {
    updateInvoiceBilledDisplay(value)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-text-primary dark:text-white">
            Settings
          </h1>
          <p className="mt-2 text-sm text-text-secondary dark:text-gray-300">
            Configure your application preferences
          </p>
        </div>
      </div>

      {/* Settings Categories */}
      <div className="space-y-8">
        {/* Invoice Settings */}
        <div className={combineThemeClasses("bg-white shadow ring-1 ring-black ring-opacity-5 md:rounded-lg", themeClasses.card)}>
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <FileText className="h-5 w-5 text-primary-500 mr-3" />
              <h2 className="text-lg font-medium text-text-primary dark:text-white">
                Invoice Settings
              </h2>
            </div>
          </div>
          <div className="px-6 py-4">
            <div className="space-y-4">
              <div>
                <label className={combineThemeClasses("block text-sm font-medium mb-3", themeClasses.form.label)}>
                  Contract "Total Billed" Display Format
                </label>
                <p className="text-sm text-text-secondary dark:text-gray-400 mb-4">
                  Choose how to display the total billed amount for contracts in the contracts table.
                </p>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="invoiceBilledDisplay"
                      value="paid-vs-total"
                      checked={invoiceBilledDisplay === 'paid-vs-total'}
                      onChange={(e) => handleInvoiceBilledDisplayChange(e.target.value)}
                      className="mr-3 text-primary-600 focus:ring-primary-500"
                    />
                    <div>
                      <div className="text-sm font-medium text-text-primary dark:text-white">
                        Paid vs Total (e.g., "$1,500/$3,000")
                      </div>
                      <div className="text-xs text-text-secondary dark:text-gray-400">
                        Shows paid amount out of total invoiced amount
                      </div>
                    </div>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="invoiceBilledDisplay"
                      value="paid-only"
                      checked={invoiceBilledDisplay === 'paid-only'}
                      onChange={(e) => handleInvoiceBilledDisplayChange(e.target.value)}
                      className="mr-3 text-primary-600 focus:ring-primary-500"
                    />
                    <div>
                      <div className="text-sm font-medium text-text-primary dark:text-white">
                        Paid Only (e.g., "$1,500")
                      </div>
                      <div className="text-xs text-text-secondary dark:text-gray-400">
                        Shows only the amount that has been paid
                      </div>
                    </div>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="invoiceBilledDisplay"
                      value="all-invoices"
                      checked={invoiceBilledDisplay === 'all-invoices'}
                      onChange={(e) => handleInvoiceBilledDisplayChange(e.target.value)}
                      className="mr-3 text-primary-600 focus:ring-primary-500"
                    />
                    <div>
                      <div className="text-sm font-medium text-text-primary dark:text-white">
                        All Invoices (e.g., "$3,000")
                      </div>
                      <div className="text-xs text-text-secondary dark:text-gray-400">
                        Shows the total of all invoices regardless of payment status
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Coming Soon */}
        <div className={combineThemeClasses("bg-white shadow ring-1 ring-black ring-opacity-5 md:rounded-lg", themeClasses.card)}>
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <SettingsIcon className="h-5 w-5 text-primary-500 mr-3" />
              <h2 className="text-lg font-medium text-text-primary dark:text-white">
                General Settings
              </h2>
            </div>
          </div>
          <div className="px-6 py-4">
            <p className="text-sm text-text-secondary dark:text-gray-400">
              More settings options will be available in future updates.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings
