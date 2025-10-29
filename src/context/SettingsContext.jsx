import React, { createContext, useContext, useReducer, useCallback, useMemo } from 'react'

const SettingsContext = createContext()

const initialState = {
  invoiceBilledDisplay: (() => {
    try {
      return JSON.parse(localStorage.getItem('loomlance-settings-invoice-billed-display') ?? '"paid-vs-total"')
    } catch (error) {
      console.error('Error reading invoice billed display setting:', error)
      return 'paid-vs-total'
    }
  })(),
}

function settingsReducer(state, action) {
  switch (action.type) {
    case 'UPDATE_INVOICE_BILLED_DISPLAY':
      try {
        localStorage.setItem('loomlance-settings-invoice-billed-display', JSON.stringify(action.payload))
      } catch (error) {
        console.error('Error saving invoice billed display setting:', error)
      }
      return { ...state, invoiceBilledDisplay: action.payload }
    case 'RESET_SETTINGS':
      try {
        localStorage.removeItem('loomlance-settings-invoice-billed-display')
      } catch (error) {
        console.error('Error resetting settings:', error)
      }
      return initialState
    default:
      return state
  }
}

export function SettingsProvider({ children }) {
  const [state, dispatch] = useReducer(settingsReducer, initialState)

  const updateInvoiceBilledDisplay = useCallback((value) => {
    dispatch({ type: 'UPDATE_INVOICE_BILLED_DISPLAY', payload: value })
  }, [])

  const resetSettings = useCallback(() => {
    dispatch({ type: 'RESET_SETTINGS' })
  }, [])

  const contextValue = useMemo(() => ({
    ...state,
    updateInvoiceBilledDisplay,
    resetSettings,
  }), [state, updateInvoiceBilledDisplay, resetSettings])

  return <SettingsContext.Provider value={contextValue}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}

// Context selector hooks for specific settings data
export const useInvoiceBilledDisplay = () => {
  const { invoiceBilledDisplay } = useSettings()
  return invoiceBilledDisplay
}

export const useSettingsActions = () => {
  const { updateInvoiceBilledDisplay, resetSettings } = useSettings()
  return { updateInvoiceBilledDisplay, resetSettings }
}
