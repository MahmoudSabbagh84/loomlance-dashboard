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

// Generate unique ID
const generateUID = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

// Get next invoice number
const getNextInvoiceNumber = () => {
  const lastInvoiceNumber = localStorage.getItem('loomlance-last-invoice-number') || '0'
  const nextNumber = parseInt(lastInvoiceNumber) + 1
  localStorage.setItem('loomlance-last-invoice-number', nextNumber.toString())
  return `INV-${nextNumber.toString().padStart(4, '0')}`
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
      uid: generateUID(),
      title: 'Web Development Project',
      clientName: 'Tech Corp',
      startDate: '2024-01-01',
      endDate: '2024-06-30',
      status: 'active',
      description: 'Full-stack web development for e-commerce platform',
      totalValue: 15000,
      hourlyRate: 75,
      estimatedHours: 200
    },
    {
      id: 2,
      uid: generateUID(),
      title: 'Mobile App Development',
      clientName: 'StartupXYZ',
      startDate: '2024-02-01',
      endDate: '2024-08-31',
      status: 'active',
      description: 'React Native mobile application development',
      totalValue: 12000,
      hourlyRate: 80,
      estimatedHours: 150
    },
    {
      id: 3,
      uid: generateUID(),
      title: 'UI/UX Design Project',
      clientName: 'Design Studio',
      startDate: '2024-01-15',
      endDate: '2024-04-15',
      status: 'active',
      description: 'Complete UI/UX redesign for existing web application',
      totalValue: 8000,
      hourlyRate: 65,
      estimatedHours: 123
    },
    {
      id: 4,
      uid: generateUID(),
      title: 'Database Migration',
      clientName: 'Enterprise Inc',
      startDate: '2024-03-01',
      endDate: '2024-05-31',
      status: 'pending',
      description: 'Migrate legacy database to modern cloud solution',
      totalValue: 20000,
      hourlyRate: 100,
      estimatedHours: 200
    },
    {
      id: 5,
      uid: generateUID(),
      title: 'API Integration',
      clientName: 'SaaS Company',
      startDate: '2024-02-15',
      endDate: '2024-04-15',
      status: 'pending',
      description: 'Integrate third-party APIs with existing system',
      totalValue: 6000,
      hourlyRate: 70,
      estimatedHours: 86
    },
    {
      id: 6,
      uid: generateUID(),
      title: 'Security Audit',
      clientName: 'Finance Corp',
      startDate: '2024-01-01',
      endDate: '2024-03-31',
      status: 'pending',
      description: 'Comprehensive security audit and recommendations',
      totalValue: 10000,
      hourlyRate: 90,
      estimatedHours: 111
    },
    {
      id: 7,
      uid: generateUID(),
      title: 'Legacy System Maintenance',
      clientName: 'Old Corp',
      startDate: '2023-06-01',
      endDate: '2023-12-31',
      status: 'completed',
      description: 'Maintenance and updates for legacy system',
      totalValue: 5000,
      hourlyRate: 60,
      estimatedHours: 83
    },
    {
      id: 8,
      uid: generateUID(),
      title: 'Cloud Migration',
      clientName: 'Tech Startup',
      startDate: '2023-09-01',
      endDate: '2023-11-30',
      status: 'completed',
      description: 'Migrate on-premise infrastructure to AWS',
      totalValue: 18000,
      hourlyRate: 85,
      estimatedHours: 212
    },
    {
      id: 9,
      uid: generateUID(),
      title: 'Performance Optimization',
      clientName: 'E-commerce Site',
      startDate: '2023-10-01',
      endDate: '2023-12-31',
      status: 'completed',
      description: 'Optimize website performance and loading times',
      totalValue: 7500,
      hourlyRate: 75,
      estimatedHours: 100
    }
  ]
  
  initialState.contracts = sampleContracts
  localStorage.setItem('loomlance-contracts', JSON.stringify(sampleContracts))
}

// Add sample invoices if no data exists
if (initialState.invoices.length === 0) {
  // Initialize invoice numbering
  localStorage.setItem('loomlance-last-invoice-number', '6')
  
  const sampleInvoices = [
    {
      id: 1,
      uid: generateUID(),
      invoiceNumber: 'INV-0001',
      clientName: 'Tech Corp',
      amount: 5000,
      dueDate: '2024-02-15',
      status: 'paid',
      description: 'Web development project milestone 1',
      contractId: 1,
      type: 'contract-based',
      lineItems: [
        { description: 'Frontend Development', quantity: 40, rate: 75, amount: 3000 },
        { description: 'Backend API Setup', quantity: 20, rate: 75, amount: 1500 },
        { description: 'Database Design', quantity: 6.67, rate: 75, amount: 500 }
      ],
        subtotal: 5000,
        tax: 0,
        taxPercentage: 0,
        total: 5000
    },
    {
      id: 2,
      uid: generateUID(),
      invoiceNumber: 'INV-0002',
      clientName: 'StartupXYZ',
      amount: 3500,
      dueDate: '2024-02-20',
      status: 'pending',
      description: 'Mobile app development - Phase 1',
      contractId: 2,
      type: 'contract-based',
      lineItems: [
        { description: 'React Native Setup', quantity: 20, rate: 80, amount: 1600 },
        { description: 'UI Components', quantity: 15, rate: 80, amount: 1200 },
        { description: 'API Integration', quantity: 8.75, rate: 80, amount: 700 }
      ],
      subtotal: 3500,
      tax: 0,
      taxPercentage: 0,
      total: 3500
    },
    {
      id: 3,
      uid: generateUID(),
      invoiceNumber: 'INV-0003',
      clientName: 'Design Studio',
      amount: 2800,
      dueDate: '2024-02-10',
      status: 'overdue',
      description: 'UI/UX design project',
      contractId: 3,
      type: 'contract-based',
      lineItems: [
        { description: 'User Research', quantity: 20, rate: 65, amount: 1300 },
        { description: 'Wireframing', quantity: 15, rate: 65, amount: 975 },
        { description: 'Visual Design', quantity: 8.08, rate: 65, amount: 525 }
      ],
      subtotal: 2800,
      tax: 0,
      taxPercentage: 0,
      total: 2800
    },
    {
      id: 4,
      uid: generateUID(),
      invoiceNumber: 'INV-0004',
      clientName: 'Enterprise Inc',
      amount: 7500,
      dueDate: '2024-03-01',
      status: 'pending',
      description: 'Database migration project',
      contractId: 4,
      type: 'contract-based',
      lineItems: [
        { description: 'Data Analysis', quantity: 30, rate: 100, amount: 3000 },
        { description: 'Migration Scripts', quantity: 25, rate: 100, amount: 2500 },
        { description: 'Testing & Validation', quantity: 20, rate: 100, amount: 2000 }
      ],
      subtotal: 7500,
      tax: 0,
      taxPercentage: 0,
      total: 7500
    },
    {
      id: 5,
      uid: generateUID(),
      invoiceNumber: 'INV-0005',
      clientName: 'SaaS Company',
      amount: 4200,
      dueDate: '2024-01-25',
      status: 'overdue',
      description: 'API integration services',
      contractId: 5,
      type: 'contract-based',
      lineItems: [
        { description: 'API Documentation Review', quantity: 10, rate: 70, amount: 700 },
        { description: 'Integration Development', quantity: 40, rate: 70, amount: 2800 },
        { description: 'Testing & Debugging', quantity: 10, rate: 70, amount: 700 }
      ],
      subtotal: 4200,
      tax: 0,
      taxPercentage: 0,
      total: 4200
    },
    {
      id: 6,
      uid: generateUID(),
      invoiceNumber: 'INV-0006',
      clientName: 'Finance Corp',
      amount: 3200,
      dueDate: '2024-02-28',
      status: 'pending',
      description: 'Security audit consultation',
      contractId: 6,
      type: 'contract-based',
      lineItems: [
        { description: 'Security Assessment', quantity: 20, rate: 90, amount: 1800 },
        { description: 'Vulnerability Testing', quantity: 10, rate: 90, amount: 900 },
        { description: 'Report & Recommendations', quantity: 5.56, rate: 90, amount: 500 }
      ],
      subtotal: 3200,
      tax: 0,
      taxPercentage: 0,
      total: 3200
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
    const newInvoice = {
      ...invoice,
      uid: invoice.uid || generateUID(),
      invoiceNumber: invoice.invoiceNumber || getNextInvoiceNumber(),
      createdAt: invoice.createdAt || new Date().toISOString()
    }
    dispatch({ type: 'ADD_INVOICE', payload: newInvoice })
  }

  const updateInvoice = (invoice) => {
    dispatch({ type: 'UPDATE_INVOICE', payload: invoice })
  }

  const deleteInvoice = (id) => {
    dispatch({ type: 'DELETE_INVOICE', payload: id })
  }

  const addContract = (contract) => {
    const newContract = {
      ...contract,
      uid: contract.uid || generateUID(),
      createdAt: contract.createdAt || new Date().toISOString()
    }
    dispatch({ type: 'ADD_CONTRACT', payload: newContract })
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
      
      // Auto-generate invoice when contract is completed
      const existingInvoice = state.invoices.find(inv => inv.contractId === id)
      if (!existingInvoice) {
        const autoInvoice = {
          id: Date.now(),
          uid: generateUID(),
          invoiceNumber: getNextInvoiceNumber(),
          clientName: contract.clientName,
          amount: contract.totalValue,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
          status: 'pending',
          description: `Final invoice for ${contract.title}`,
          contractId: id,
          type: 'contract-based',
                lineItems: [
                  { 
                    description: contract.title, 
                    quantity: contract.estimatedHours, 
                    rate: contract.hourlyRate, 
                    amount: contract.totalValue 
                  }
                ],
                subtotal: contract.totalValue,
                tax: 0,
                taxPercentage: 0,
                total: contract.totalValue,
          createdAt: new Date().toISOString()
        }
        addInvoice(autoInvoice)
      }
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
