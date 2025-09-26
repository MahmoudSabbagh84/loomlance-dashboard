import React, { createContext, useContext, useReducer } from 'react'

const DataContext = createContext()

// Helper function to check and update invoice statuses
const updateInvoiceStatuses = (invoices) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0) // Reset time to start of day
  
  return invoices.map(invoice => {
    const dueDate = new Date(invoice.dueDate)
    dueDate.setHours(0, 0, 0, 0)
    
    // Auto-update to overdue if past due date and still pending
    if (dueDate < today && invoice.status === 'pending') {
      return { ...invoice, status: 'overdue' }
    }
    
    return invoice
  })
}

// Helper function to check and update contract statuses
const updateContractStatuses = (contracts) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  return contracts.map(contract => {
    const endDate = new Date(contract.endDate)
    endDate.setHours(0, 0, 0, 0)
    
    // Auto-update to expired if past end date and still active
    if (endDate < today && contract.status === 'active') {
      return { ...contract, status: 'expired' }
    }
    
    return contract
  })
}

// Get initial data and apply auto-updates
const getInitialInvoices = () => {
  const invoices = JSON.parse(localStorage.getItem('loomlance-invoices') || '[]')
  const updatedInvoices = updateInvoiceStatuses(invoices)
  
  // Save updated statuses if any changes were made
  if (JSON.stringify(invoices) !== JSON.stringify(updatedInvoices)) {
    localStorage.setItem('loomlance-invoices', JSON.stringify(updatedInvoices))
    // Mark that auto-updates occurred
    localStorage.setItem('loomlance-auto-updated', 'true')
  }
  
  return updatedInvoices
}

const getInitialContracts = () => {
  const contracts = JSON.parse(localStorage.getItem('loomlance-contracts') || '[]')
  const updatedContracts = updateContractStatuses(contracts)
  
  // Save updated statuses if any changes were made
  if (JSON.stringify(contracts) !== JSON.stringify(updatedContracts)) {
    localStorage.setItem('loomlance-contracts', JSON.stringify(updatedContracts))
    // Mark that auto-updates occurred
    localStorage.setItem('loomlance-auto-updated', 'true')
  }
  
  return updatedContracts
}

const initialState = {
  invoices: getInitialInvoices(),
  contracts: getInitialContracts(),
  clients: JSON.parse(localStorage.getItem('loomlance-clients') || '[]'),
}

// Add sample data if no data exists
if (initialState.contracts.length === 0) {
  const sampleContracts = [
    {
      id: 1,
      title: 'Web Development Project',
      clientName: 'Tech Corp',
      startDate: '2024-01-01',
      endDate: '2024-06-30',
      status: 'active',
      description: 'Full-stack web development for e-commerce platform'
    },
    {
      id: 2,
      title: 'Mobile App Development',
      clientName: 'StartupXYZ',
      startDate: '2024-02-01',
      endDate: '2024-08-31',
      status: 'active',
      description: 'React Native mobile application development'
    },
    {
      id: 3,
      title: 'UI/UX Design Project',
      clientName: 'Design Studio',
      startDate: '2024-01-15',
      endDate: '2024-04-15',
      status: 'active',
      description: 'Complete UI/UX redesign for existing web application'
    },
    {
      id: 4,
      title: 'Database Migration',
      clientName: 'Enterprise Inc',
      startDate: '2024-03-01',
      endDate: '2024-05-31',
      status: 'pending',
      description: 'Migrate legacy database to modern cloud solution'
    },
    {
      id: 5,
      title: 'API Integration',
      clientName: 'SaaS Company',
      startDate: '2024-02-15',
      endDate: '2024-04-15',
      status: 'pending',
      description: 'Integrate third-party APIs with existing system'
    },
    {
      id: 6,
      title: 'Security Audit',
      clientName: 'Finance Corp',
      startDate: '2024-01-01',
      endDate: '2024-03-31',
      status: 'pending',
      description: 'Comprehensive security audit and recommendations'
    },
    {
      id: 7,
      title: 'Legacy System Maintenance',
      clientName: 'Old Corp',
      startDate: '2023-06-01',
      endDate: '2023-12-31',
      status: 'completed',
      description: 'Maintenance and updates for legacy system'
    },
    {
      id: 8,
      title: 'Cloud Migration',
      clientName: 'Tech Startup',
      startDate: '2023-09-01',
      endDate: '2023-11-30',
      status: 'completed',
      description: 'Migrate on-premise infrastructure to AWS'
    },
    {
      id: 9,
      title: 'Performance Optimization',
      clientName: 'E-commerce Site',
      startDate: '2023-10-01',
      endDate: '2023-12-31',
      status: 'completed',
      description: 'Optimize website performance and loading times'
    }
  ]
  
  initialState.contracts = sampleContracts
  localStorage.setItem('loomlance-contracts', JSON.stringify(sampleContracts))
}

// Add sample invoices if no data exists
if (initialState.invoices.length === 0) {
  const sampleInvoices = [
    {
      id: 1,
      clientName: 'Tech Corp',
      amount: 5000,
      dueDate: '2024-02-15',
      status: 'paid',
      description: 'Web development project milestone 1'
    },
    {
      id: 2,
      clientName: 'StartupXYZ',
      amount: 3500,
      dueDate: '2024-02-20',
      status: 'pending',
      description: 'Mobile app development - Phase 1'
    },
    {
      id: 3,
      clientName: 'Design Studio',
      amount: 2800,
      dueDate: '2024-02-10',
      status: 'overdue',
      description: 'UI/UX design project'
    },
    {
      id: 4,
      clientName: 'Enterprise Inc',
      amount: 7500,
      dueDate: '2024-03-01',
      status: 'pending',
      description: 'Database migration project'
    },
    {
      id: 5,
      clientName: 'SaaS Company',
      amount: 4200,
      dueDate: '2024-01-25',
      status: 'overdue',
      description: 'API integration services'
    },
    {
      id: 6,
      clientName: 'Finance Corp',
      amount: 3200,
      dueDate: '2024-02-28',
      status: 'pending',
      description: 'Security audit consultation'
    }
  ]
  
  initialState.invoices = sampleInvoices
  localStorage.setItem('loomlance-invoices', JSON.stringify(sampleInvoices))
}

// Add sample clients if no data exists
if (initialState.clients.length === 0) {
  const sampleClients = [
    {
      id: 1,
      name: 'Tech Corp',
      email: 'contact@techcorp.com',
      phone: '+1 (555) 123-4567',
      company: 'Tech Corp Inc.',
      address: '123 Tech Street, Silicon Valley, CA 94000'
    },
    {
      id: 2,
      name: 'StartupXYZ',
      email: 'hello@startupxyz.com',
      phone: '+1 (555) 234-5678',
      company: 'StartupXYZ LLC',
      address: '456 Innovation Ave, Austin, TX 78701'
    },
    {
      id: 3,
      name: 'Design Studio',
      email: 'info@designstudio.com',
      phone: '+1 (555) 345-6789',
      company: 'Creative Design Studio',
      address: '789 Art District, New York, NY 10001'
    },
    {
      id: 4,
      name: 'Enterprise Inc',
      email: 'business@enterprise.com',
      phone: '+1 (555) 456-7890',
      company: 'Enterprise Solutions Inc.',
      address: '321 Corporate Blvd, Chicago, IL 60601'
    },
    {
      id: 5,
      name: 'SaaS Company',
      email: 'support@saascompany.com',
      phone: '+1 (555) 567-8901',
      company: 'SaaS Solutions Ltd.',
      address: '654 Cloud Street, Seattle, WA 98101'
    },
    {
      id: 6,
      name: 'Finance Corp',
      email: 'finance@financecorp.com',
      phone: '+1 (555) 678-9012',
      company: 'Finance Corporation',
      address: '987 Wall Street, New York, NY 10005'
    }
  ]
  
  initialState.clients = sampleClients
  localStorage.setItem('loomlance-clients', JSON.stringify(sampleClients))
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
    
    case 'BULK_UPDATE_INVOICES':
      return { ...state, invoices: action.payload }
    
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

  // Quick status update functions
  const markInvoiceAsPaid = (id) => {
    const invoice = state.invoices.find(inv => inv.id === id)
    if (invoice) {
      updateInvoice({ ...invoice, status: 'paid' })
    }
  }

  const markInvoiceAsPending = (id) => {
    const invoice = state.invoices.find(inv => inv.id === id)
    if (invoice) {
      updateInvoice({ ...invoice, status: 'pending' })
    }
  }

  const markContractAsActive = (id) => {
    const contract = state.contracts.find(cont => cont.id === id)
    if (contract) {
      updateContract({ ...contract, status: 'active' })
    }
  }

  const markContractAsCompleted = (id) => {
    const contract = state.contracts.find(cont => cont.id === id)
    if (contract) {
      updateContract({ ...contract, status: 'completed' })
    }
  }

  const markContractAsPending = (id) => {
    const contract = state.contracts.find(cont => cont.id === id)
    if (contract) {
      updateContract({ ...contract, status: 'pending' })
    }
  }

  // Bulk actions
  const markAllInvoicesAsPaid = () => {
    const updatedInvoices = state.invoices.map(invoice => 
      invoice.status === 'pending' || invoice.status === 'overdue' 
        ? { ...invoice, status: 'paid' }
        : invoice
    )
    localStorage.setItem('loomlance-invoices', JSON.stringify(updatedInvoices))
    dispatch({ type: 'BULK_UPDATE_INVOICES', payload: updatedInvoices })
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
    // Quick status updates
    markInvoiceAsPaid,
    markInvoiceAsPending,
    markContractAsActive,
    markContractAsCompleted,
    markContractAsPending,
    // Bulk actions
    markAllInvoicesAsPaid,
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
