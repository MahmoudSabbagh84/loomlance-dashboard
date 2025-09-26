import React, { createContext, useContext, useReducer } from 'react'

const DataContext = createContext()

const initialState = {
  invoices: JSON.parse(localStorage.getItem('loomlance-invoices') || '[]'),
  contracts: JSON.parse(localStorage.getItem('loomlance-contracts') || '[]'),
  clients: JSON.parse(localStorage.getItem('loomlance-clients') || '[]'),
}

function dataReducer(state, action) {
  switch (action.type) {
    case 'ADD_INVOICE':
      const newInvoices = [...state.invoices, action.payload]
      localStorage.setItem('loomlance-invoices', JSON.stringify(newInvoices))
      return { ...state, invoices: newInvoices }
    
    case 'UPDATE_INVOICE':
      const updatedInvoices = state.invoices.map(invoice => 
        invoice.id === action.payload.id ? action.payload : invoice
      )
      localStorage.setItem('loomlance-invoices', JSON.stringify(updatedInvoices))
      return { ...state, invoices: updatedInvoices }
    
    case 'DELETE_INVOICE':
      const filteredInvoices = state.invoices.filter(invoice => invoice.id !== action.payload)
      localStorage.setItem('loomlance-invoices', JSON.stringify(filteredInvoices))
      return { ...state, invoices: filteredInvoices }
    
    case 'ADD_CONTRACT':
      const newContracts = [...state.contracts, action.payload]
      localStorage.setItem('loomlance-contracts', JSON.stringify(newContracts))
      return { ...state, contracts: newContracts }
    
    case 'UPDATE_CONTRACT':
      const updatedContracts = state.contracts.map(contract => 
        contract.id === action.payload.id ? action.payload : contract
      )
      localStorage.setItem('loomlance-contracts', JSON.stringify(updatedContracts))
      return { ...state, contracts: updatedContracts }
    
    case 'DELETE_CONTRACT':
      const filteredContracts = state.contracts.filter(contract => contract.id !== action.payload)
      localStorage.setItem('loomlance-contracts', JSON.stringify(filteredContracts))
      return { ...state, contracts: filteredContracts }
    
    case 'ADD_CLIENT':
      const newClients = [...state.clients, action.payload]
      localStorage.setItem('loomlance-clients', JSON.stringify(newClients))
      return { ...state, clients: newClients }
    
    case 'UPDATE_CLIENT':
      const updatedClients = state.clients.map(client => 
        client.id === action.payload.id ? action.payload : client
      )
      localStorage.setItem('loomlance-clients', JSON.stringify(updatedClients))
      return { ...state, clients: updatedClients }
    
    case 'DELETE_CLIENT':
      const filteredClients = state.clients.filter(client => client.id !== action.payload)
      localStorage.setItem('loomlance-clients', JSON.stringify(filteredClients))
      return { ...state, clients: filteredClients }
    
    default:
      return state
  }
}

export function DataProvider({ children }) {
  const [state, dispatch] = useReducer(dataReducer, initialState)

  const addInvoice = (invoice) => {
    dispatch({ type: 'ADD_INVOICE', payload: invoice })
  }

  const updateInvoice = (invoice) => {
    dispatch({ type: 'UPDATE_INVOICE', payload: invoice })
  }

  const deleteInvoice = (id) => {
    dispatch({ type: 'DELETE_INVOICE', payload: id })
  }

  const addContract = (contract) => {
    dispatch({ type: 'ADD_CONTRACT', payload: contract })
  }

  const updateContract = (contract) => {
    dispatch({ type: 'UPDATE_CONTRACT', payload: contract })
  }

  const deleteContract = (id) => {
    dispatch({ type: 'DELETE_CONTRACT', payload: id })
  }

  const addClient = (client) => {
    dispatch({ type: 'ADD_CLIENT', payload: client })
  }

  const updateClient = (client) => {
    dispatch({ type: 'UPDATE_CLIENT', payload: client })
  }

  const deleteClient = (id) => {
    dispatch({ type: 'DELETE_CLIENT', payload: id })
  }

  const value = {
    ...state,
    addInvoice,
    updateInvoice,
    deleteInvoice,
    addContract,
    updateContract,
    deleteContract,
    addClient,
    updateClient,
    deleteClient,
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const context = useContext(DataContext)
  if (!context) {
    throw new Error('useData must be used within a DataProvider')
  }
  return context
}
