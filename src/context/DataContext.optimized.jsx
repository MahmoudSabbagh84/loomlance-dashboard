import React, { createContext, useContext, useReducer, useState, useMemo, useCallback } from 'react'

const DataContext = createContext()

// Helper functions moved outside component to prevent recreation
const updateInvoiceStatuses = (invoices) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  return invoices.map(invoice => {
    const dueDate = new Date(invoice.dueDate)
    dueDate.setHours(0, 0, 0, 0)
    
    if (dueDate < today && invoice.status === 'pending') {
      return { ...invoice, status: 'overdue' }
    }
    return invoice
  })
}

const updateContractStatuses = (contracts) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  return contracts.map(contract => {
    const endDate = new Date(contract.endDate)
    endDate.setHours(0, 0, 0, 0)
    
    if (endDate < today && contract.status === 'active') {
      return { ...contract, status: 'expired' }
    }
    return contract
  })
}

const generateUID = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

const getNextInvoiceNumber = () => {
  const lastInvoiceNumber = localStorage.getItem('loomlance-last-invoice-number') || '0'
  const nextNumber = parseInt(lastInvoiceNumber) + 1
  localStorage.setItem('loomlance-last-invoice-number', nextNumber.toString())
  return `INV-${nextNumber.toString().padStart(4, '0')}`
}

// Memoized helper functions
const createMemoizedHelpers = () => {
  const getContractInvoices = (contractUid, invoices) => {
    return invoices.filter(invoice => invoice.contractUid === contractUid)
  }

  const getContractInvoiceTotal = (contractUid, invoices, invoiceBilledDisplay = 'paid-vs-total') => {
    const contractInvoices = getContractInvoices(contractUid, invoices)
    const paidTotal = contractInvoices
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0)
    const allTotal = contractInvoices
      .reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0)

    switch (invoiceBilledDisplay) {
      case 'paid-only':
        return paidTotal
      case 'all-invoices':
        return allTotal
      case 'paid-vs-total':
      default:
        return { paid: paidTotal, total: allTotal }
    }
  }

  return { getContractInvoices, getContractInvoiceTotal }
}

// Reducer for better state management
const dataReducer = (state, action) => {
  switch (action.type) {
    case 'SET_INVOICES':
      return { ...state, invoices: updateInvoiceStatuses(action.payload) }
    case 'SET_CONTRACTS':
      return { ...state, contracts: updateContractStatuses(action.payload) }
    case 'SET_CLIENTS':
      return { ...state, clients: action.payload }
    case 'ADD_INVOICE':
      return { ...state, invoices: [...state.invoices, action.payload] }
    case 'UPDATE_INVOICE':
      return {
        ...state,
        invoices: state.invoices.map(inv => 
          inv.id === action.payload.id ? action.payload : inv
        )
      }
    case 'DELETE_INVOICE':
      return {
        ...state,
        invoices: state.invoices.filter(inv => inv.id !== action.payload)
      }
    case 'ADD_CONTRACT':
      return { ...state, contracts: [...state.contracts, action.payload] }
    case 'UPDATE_CONTRACT':
      return {
        ...state,
        contracts: state.contracts.map(cont => 
          cont.id === action.payload.id ? action.payload : cont
        )
      }
    case 'DELETE_CONTRACT':
      return {
        ...state,
        contracts: state.contracts.filter(cont => cont.id !== action.payload)
      }
    case 'ADD_CLIENT':
      return { ...state, clients: [...state.clients, action.payload] }
    case 'UPDATE_CLIENT':
      return {
        ...state,
        clients: state.clients.map(client => 
          client.id === action.payload.id ? action.payload : client
        )
      }
    case 'DELETE_CLIENT':
      return {
        ...state,
        clients: state.clients.filter(client => client.id !== action.payload)
      }
    default:
      return state
  }
}

// Initial state with sample data
const createInitialState = () => {
  const initialState = {
    invoices: [],
    contracts: [],
    clients: []
  }

  // Load from localStorage with error handling
  try {
    const storedInvoices = localStorage.getItem('loomlance-invoices')
    const storedContracts = localStorage.getItem('loomlance-contracts')
    const storedClients = localStorage.getItem('loomlance-clients')

    if (storedInvoices) {
      initialState.invoices = updateInvoiceStatuses(JSON.parse(storedInvoices))
    }
    if (storedContracts) {
      initialState.contracts = updateContractStatuses(JSON.parse(storedContracts))
    }
    if (storedClients) {
      initialState.clients = JSON.parse(storedClients)
    }
  } catch (error) {
    console.error('Error loading data from localStorage:', error)
  }

  return initialState
}

export function DataProvider({ children }) {
  const [state, dispatch] = useReducer(dataReducer, createInitialState())
  const [archivedContracts, setArchivedContracts] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('loomlance-archived-contracts') || '[]')
    } catch {
      return []
    }
  })
  const [archivedInvoices, setArchivedInvoices] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('loomlance-archived-invoices') || '[]')
    } catch {
      return []
    }
  })
  const [archivedClients, setArchivedClients] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('loomlance-archived-clients') || '[]')
    } catch {
      return []
    }
  })

  // Memoized helpers
  const helpers = useMemo(() => createMemoizedHelpers(), [])

  // Optimized action creators with useCallback
  const addInvoice = useCallback((invoice) => {
    const newInvoice = {
      ...invoice,
      id: invoice.id || Date.now(),
      uid: invoice.uid || generateUID(),
      createdAt: invoice.createdAt || new Date().toISOString()
    }
    dispatch({ type: 'ADD_INVOICE', payload: newInvoice })
    
    try {
      const updatedInvoices = [...state.invoices, newInvoice]
      localStorage.setItem('loomlance-invoices', JSON.stringify(updatedInvoices))
    } catch (error) {
      console.error('Error saving invoice to localStorage:', error)
    }
  }, [state.invoices])

  const updateInvoice = useCallback((updatedInvoice) => {
    dispatch({ type: 'UPDATE_INVOICE', payload: updatedInvoice })
    
    try {
      const updatedInvoices = state.invoices.map(inv => 
        inv.id === updatedInvoice.id ? updatedInvoice : inv
      )
      localStorage.setItem('loomlance-invoices', JSON.stringify(updatedInvoices))
    } catch (error) {
      console.error('Error updating invoice in localStorage:', error)
    }
  }, [state.invoices])

  const deleteInvoice = useCallback((id) => {
    dispatch({ type: 'DELETE_INVOICE', payload: id })
    
    try {
      const updatedInvoices = state.invoices.filter(inv => inv.id !== id)
      localStorage.setItem('loomlance-invoices', JSON.stringify(updatedInvoices))
    } catch (error) {
      console.error('Error deleting invoice from localStorage:', error)
    }
  }, [state.invoices])

  const addContract = useCallback((contract) => {
    const newContract = {
      ...contract,
      id: contract.id || Date.now(),
      uid: contract.uid || generateUID(),
      createdAt: contract.createdAt || new Date().toISOString()
    }
    dispatch({ type: 'ADD_CONTRACT', payload: newContract })
    
    try {
      const updatedContracts = [...state.contracts, newContract]
      localStorage.setItem('loomlance-contracts', JSON.stringify(updatedContracts))
    } catch (error) {
      console.error('Error saving contract to localStorage:', error)
    }
  }, [state.contracts])

  const updateContract = useCallback((updatedContract) => {
    dispatch({ type: 'UPDATE_CONTRACT', payload: updatedContract })
    
    try {
      const updatedContracts = state.contracts.map(cont => 
        cont.id === updatedContract.id ? updatedContract : cont
      )
      localStorage.setItem('loomlance-contracts', JSON.stringify(updatedContracts))
    } catch (error) {
      console.error('Error updating contract in localStorage:', error)
    }
  }, [state.contracts])

  const deleteContract = useCallback((id) => {
    dispatch({ type: 'DELETE_CONTRACT', payload: id })
    
    try {
      const updatedContracts = state.contracts.filter(cont => cont.id !== id)
      localStorage.setItem('loomlance-contracts', JSON.stringify(updatedContracts))
    } catch (error) {
      console.error('Error deleting contract from localStorage:', error)
    }
  }, [state.contracts])

  const addClient = useCallback((client) => {
    const newClient = {
      ...client,
      id: client.id || Date.now(),
      createdAt: client.createdAt || new Date().toISOString()
    }
    dispatch({ type: 'ADD_CLIENT', payload: newClient })
    
    try {
      const updatedClients = [...state.clients, newClient]
      localStorage.setItem('loomlance-clients', JSON.stringify(updatedClients))
    } catch (error) {
      console.error('Error saving client to localStorage:', error)
    }
  }, [state.clients])

  const updateClient = useCallback((updatedClient) => {
    dispatch({ type: 'UPDATE_CLIENT', payload: updatedClient })
    
    try {
      const updatedClients = state.clients.map(client => 
        client.id === updatedClient.id ? updatedClient : client
      )
      localStorage.setItem('loomlance-clients', JSON.stringify(updatedClients))
    } catch (error) {
      console.error('Error updating client in localStorage:', error)
    }
  }, [state.clients])

  const deleteClient = useCallback((id) => {
    dispatch({ type: 'DELETE_CLIENT', payload: id })
    
    try {
      const updatedClients = state.clients.filter(client => client.id !== id)
      localStorage.setItem('loomlance-clients', JSON.stringify(updatedClients))
    } catch (error) {
      console.error('Error deleting client from localStorage:', error)
    }
  }, [state.clients])

  // Archive functions
  const archiveContract = useCallback((id) => {
    const contract = state.contracts.find(c => c.id === id)
    if (contract) {
      setArchivedContracts(prev => [...prev, contract])
      deleteContract(id)
    }
  }, [state.contracts, deleteContract])

  const archiveInvoice = useCallback((id) => {
    const invoice = state.invoices.find(i => i.id === id)
    if (invoice) {
      setArchivedInvoices(prev => [...prev, invoice])
      deleteInvoice(id)
    }
  }, [state.invoices, deleteInvoice])

  const archiveClient = useCallback((id) => {
    const client = state.clients.find(c => c.id === id)
    if (client) {
      setArchivedClients(prev => [...prev, client])
      deleteClient(id)
    }
  }, [state.clients, deleteClient])

  const restoreContract = useCallback((id) => {
    const contract = archivedContracts.find(c => c.id === id)
    if (contract) {
      addContract(contract)
      setArchivedContracts(prev => prev.filter(c => c.id !== id))
    }
  }, [archivedContracts, addContract])

  const restoreInvoice = useCallback((id) => {
    const invoice = archivedInvoices.find(i => i.id === id)
    if (invoice) {
      addInvoice(invoice)
      setArchivedInvoices(prev => prev.filter(i => i.id !== id))
    }
  }, [archivedInvoices, addInvoice])

  const restoreClient = useCallback((id) => {
    const client = archivedClients.find(c => c.id === id)
    if (client) {
      addClient(client)
      setArchivedClients(prev => prev.filter(c => c.id !== id))
    }
  }, [archivedClients, addClient])

  // Memoized context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    // State
    ...state,
    archivedContracts,
    archivedInvoices,
    archivedClients,
    
    // Actions
    addInvoice,
    updateInvoice,
    deleteInvoice,
    addContract,
    updateContract,
    deleteContract,
    addClient,
    updateClient,
    deleteClient,
    
    // Archive actions
    archiveContract,
    archiveInvoice,
    archiveClient,
    restoreContract,
    restoreInvoice,
    restoreClient,
    
    // Helpers
    getContractInvoices: (contractUid) => helpers.getContractInvoices(contractUid, state.invoices),
    getContractInvoiceTotal: (contractUid, invoiceBilledDisplay) => 
      helpers.getContractInvoiceTotal(contractUid, state.invoices, invoiceBilledDisplay),
    
    // Utility functions
    generateUID,
    getNextInvoiceNumber
  }), [
    state,
    archivedContracts,
    archivedInvoices,
    archivedClients,
    addInvoice,
    updateInvoice,
    deleteInvoice,
    addContract,
    updateContract,
    deleteContract,
    addClient,
    updateClient,
    deleteClient,
    archiveContract,
    archiveInvoice,
    archiveClient,
    restoreContract,
    restoreInvoice,
    restoreClient,
    helpers
  ])

  return (
    <DataContext.Provider value={contextValue}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const context = useContext(DataContext)
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider')
  }
  return context
}
