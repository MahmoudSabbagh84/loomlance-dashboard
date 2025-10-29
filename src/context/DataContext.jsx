import React, { createContext, useContext, useReducer, useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { memoryOptimizations } from '../utils/performance'

const DataContext = createContext()

// Debounced localStorage operations
const debouncedSetItem = memoryOptimizations.debounce((key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.error(`Failed to save ${key} to localStorage:`, error)
  }
}, 100)

// Helper function to check and update invoice statuses with modern patterns
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

// Helper function to check and update contract statuses with modern patterns
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

// Generate unique ID with modern crypto API fallback
const generateUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

// Get next invoice number with modern patterns
const getNextInvoiceNumber = () => {
  const lastInvoiceNumber = localStorage.getItem('loomlance-last-invoice-number') ?? '0'
  const nextNumber = parseInt(lastInvoiceNumber) + 1
  localStorage.setItem('loomlance-last-invoice-number', nextNumber.toString())
  return `INV-${nextNumber.toString().padStart(4, '0')}`
}

// Memoized data retrieval functions
const getInitialInvoices = () => {
  try {
    const invoices = JSON.parse(localStorage.getItem('loomlance-invoices') ?? '[]')
    const updatedInvoices = updateInvoiceStatuses(invoices)
    
    // Save updated statuses if any changes were made
    if (JSON.stringify(invoices) !== JSON.stringify(updatedInvoices)) {
      debouncedSetItem('loomlance-invoices', updatedInvoices)
      localStorage.setItem('loomlance-auto-updated', 'true')
    }
    
    return updatedInvoices
  } catch (error) {
    console.error('Error loading invoices:', error)
    return []
  }
}

const getInitialContracts = () => {
  try {
    const contracts = JSON.parse(localStorage.getItem('loomlance-contracts') ?? '[]')
    const updatedContracts = updateContractStatuses(contracts)
    
    // Save updated statuses if any changes were made
    if (JSON.stringify(contracts) !== JSON.stringify(updatedContracts)) {
      debouncedSetItem('loomlance-contracts', updatedContracts)
      localStorage.setItem('loomlance-auto-updated', 'true')
    }
    
    return updatedContracts
  } catch (error) {
    console.error('Error loading contracts:', error)
    return []
  }
}

const getInitialClients = () => {
  try {
    return JSON.parse(localStorage.getItem('loomlance-clients') ?? '[]')
  } catch (error) {
    console.error('Error loading clients:', error)
    return []
  }
}

const initialState = {
  invoices: getInitialInvoices(),
  contracts: getInitialContracts(),
  clients: getInitialClients(),
}

// Add sample data if no data exists
if (initialState.contracts.length === 0) {
  const sampleContracts = [
    {
      id: 1,
      uid: 'contract-tech-corp-web-dev',
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
      uid: 'contract-startupxyz-mobile',
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
      uid: 'contract-design-studio-ui',
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
      uid: 'contract-enterprise-db-migration',
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
      uid: 'contract-saas-company-api',
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
      uid: 'contract-finance-corp-security',
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
      contractUid: 'contract-tech-corp-web-dev',
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
      contractUid: 'contract-startupxyz-mobile',
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
      contractUid: 'contract-design-studio-ui',
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
      contractUid: 'contract-enterprise-db-migration',
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
      contractUid: 'contract-saas-company-api',
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
      contractUid: 'contract-finance-corp-security',
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
      streetAddress: '123 Tech Street',
      city: 'Silicon Valley',
      state: 'CA',
      zipCode: '94000'
    },
    {
      id: 2,
      name: 'StartupXYZ',
      email: 'hello@startupxyz.com',
      phone: '+1 (555) 234-5678',
      company: 'StartupXYZ LLC',
      streetAddress: '456 Innovation Ave',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701'
    },
    {
      id: 3,
      name: 'Design Studio',
      email: 'info@designstudio.com',
      phone: '+1 (555) 345-6789',
      company: 'Creative Design Studio',
      streetAddress: '789 Art District',
      city: 'New York',
      state: 'NY',
      zipCode: '10001'
    },
    {
      id: 4,
      name: 'Enterprise Inc',
      email: 'business@enterprise.com',
      phone: '+1 (555) 456-7890',
      company: 'Enterprise Solutions Inc.',
      streetAddress: '321 Corporate Blvd',
      city: 'Chicago',
      state: 'IL',
      zipCode: '60601'
    },
    {
      id: 5,
      name: 'SaaS Company',
      email: 'support@saascompany.com',
      phone: '+1 (555) 567-8901',
      company: 'SaaS Solutions Ltd.',
      streetAddress: '654 Cloud Street',
      city: 'Seattle',
      state: 'WA',
      zipCode: '98101'
    },
    {
      id: 6,
      name: 'Finance Corp',
      email: 'finance@financecorp.com',
      phone: '+1 (555) 678-9012',
      company: 'Finance Corporation',
      streetAddress: '987 Wall Street',
      city: 'New York',
      state: 'NY',
      zipCode: '10005'
    }
  ]
  
  initialState.clients = sampleClients
  localStorage.setItem('loomlance-clients', JSON.stringify(sampleClients))
}

// Optimized reducer with batch updates and modern patterns
function dataReducer(state, action) {
  switch (action.type) {
    case 'ADD_INVOICE':
      const newInvoices = [...state.invoices, action.payload]
      debouncedSetItem('loomlance-invoices', newInvoices)
      return { ...state, invoices: newInvoices }
    
    case 'UPDATE_INVOICE':
      const updatedInvoices = state.invoices.map(invoice => 
        invoice.id === action.payload.id ? action.payload : invoice
      )
      debouncedSetItem('loomlance-invoices', updatedInvoices)
      return { ...state, invoices: updatedInvoices }
    
    case 'DELETE_INVOICE':
      const filteredInvoices = state.invoices.filter(invoice => invoice.id !== action.payload)
      debouncedSetItem('loomlance-invoices', filteredInvoices)
      return { ...state, invoices: filteredInvoices }
    
    case 'ADD_CONTRACT':
      const newContracts = [...state.contracts, action.payload]
      debouncedSetItem('loomlance-contracts', newContracts)
      return { ...state, contracts: newContracts }
    
    case 'UPDATE_CONTRACT':
      const updatedContracts = state.contracts.map(contract => 
        contract.id === action.payload.id ? action.payload : contract
      )
      debouncedSetItem('loomlance-contracts', updatedContracts)
      return { ...state, contracts: updatedContracts }
    
    case 'DELETE_CONTRACT':
      const filteredContracts = state.contracts.filter(contract => contract.id !== action.payload)
      debouncedSetItem('loomlance-contracts', filteredContracts)
      return { ...state, contracts: filteredContracts }
    
    case 'ADD_CLIENT':
      const newClients = [...state.clients, action.payload]
      debouncedSetItem('loomlance-clients', newClients)
      return { ...state, clients: newClients }
    
    case 'UPDATE_CLIENT':
      const updatedClients = state.clients.map(client => 
        client.id === action.payload.id ? action.payload : client
      )
      debouncedSetItem('loomlance-clients', updatedClients)
      return { ...state, clients: updatedClients }
    
    case 'DELETE_CLIENT':
      const filteredClients = state.clients.filter(client => client.id !== action.payload)
      debouncedSetItem('loomlance-clients', filteredClients)
      return { ...state, clients: filteredClients }
    
    case 'BULK_UPDATE_INVOICES':
      debouncedSetItem('loomlance-invoices', action.payload)
      return { ...state, invoices: action.payload }
    
    case 'BATCH_UPDATE':
      // Handle multiple updates in a single action
      const { invoices: batchInvoices, contracts: batchContracts, clients: batchClients } = action.payload
      if (batchInvoices) debouncedSetItem('loomlance-invoices', batchInvoices)
      if (batchContracts) debouncedSetItem('loomlance-contracts', batchContracts)
      if (batchClients) debouncedSetItem('loomlance-clients', batchClients)
      
      return {
        ...state,
        ...(batchInvoices && { invoices: batchInvoices }),
        ...(batchContracts && { contracts: batchContracts }),
        ...(batchClients && { clients: batchClients })
      }
    
    default:
      return state
  }
}

export function DataProvider({ children }) {
  const [state, dispatch] = useReducer(dataReducer, initialState)
  
  // Archive state with lazy initialization
  const [archivedContracts, setArchivedContracts] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('loomlance-archived-contracts') ?? '[]')
    } catch {
      return []
    }
  })
  
  const [archivedInvoices, setArchivedInvoices] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('loomlance-archived-invoices') ?? '[]')
    } catch {
      return []
    }
  })
  
  const [archivedClients, setArchivedClients] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('loomlance-archived-clients') ?? '[]')
    } catch {
      return []
    }
  })

  // Memoized action creators with useCallback
  const addInvoice = useCallback((invoice) => {
    const newInvoice = {
      ...invoice,
      uid: invoice.uid ?? generateUID(),
      invoiceNumber: invoice.invoiceNumber ?? getNextInvoiceNumber(),
      createdAt: invoice.createdAt ?? new Date().toISOString()
    }
    dispatch({ type: 'ADD_INVOICE', payload: newInvoice })
  }, [])

  const updateInvoice = useCallback((invoice) => {
    if (!invoice?.id) {
      console.error('Invalid invoice data provided to updateInvoice')
      return
    }
    dispatch({ type: 'UPDATE_INVOICE', payload: invoice })
  }, [])

  const deleteInvoice = useCallback((id) => {
    dispatch({ type: 'DELETE_INVOICE', payload: id })
  }, [])

  const addContract = useCallback((contract) => {
    const newContract = {
      ...contract,
      uid: contract.uid ?? generateUID(),
      createdAt: contract.createdAt ?? new Date().toISOString()
    }
    dispatch({ type: 'ADD_CONTRACT', payload: newContract })
  }, [])

  const updateContract = useCallback((contract) => {
    dispatch({ type: 'UPDATE_CONTRACT', payload: contract })
  }, [])

  const deleteContract = useCallback((id) => {
    dispatch({ type: 'DELETE_CONTRACT', payload: id })
  }, [])

  const addClient = useCallback((client) => {
    dispatch({ type: 'ADD_CLIENT', payload: client })
  }, [])

  const updateClient = useCallback((client) => {
    dispatch({ type: 'UPDATE_CLIENT', payload: client })
  }, [])

  const deleteClient = useCallback((id) => {
    dispatch({ type: 'DELETE_CLIENT', payload: id })
  }, [])

  // Quick status update functions with memoization
  const markInvoiceAsPaid = useCallback((id) => {
    const invoice = state.invoices.find(inv => inv.id === id)
    if (invoice) {
      updateInvoice({ ...invoice, status: 'paid' })
    }
  }, [state.invoices, updateInvoice])

  const markInvoiceAsPending = useCallback((id) => {
    const invoice = state.invoices.find(inv => inv.id === id)
    if (invoice) {
      updateInvoice({ ...invoice, status: 'pending' })
    }
  }, [state.invoices, updateInvoice])

  const markContractAsActive = useCallback((id) => {
    const contract = state.contracts.find(cont => cont.id === id)
    if (contract) {
      updateContract({ ...contract, status: 'active' })
    }
  }, [state.contracts, updateContract])

  const markContractAsCompleted = useCallback((id) => {
    const contract = state.contracts.find(cont => cont.id === id)
    if (contract) {
      updateContract({ ...contract, status: 'completed' })
      
      // Auto-generate invoice when contract is completed
      const existingInvoice = state.invoices.find(inv => inv.contractUid === contract.uid)
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
          contractUid: contract.uid,
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
  }, [state.contracts, state.invoices, updateContract, addInvoice])

  const markContractAsPending = useCallback((id) => {
    const contract = state.contracts.find(cont => cont.id === id)
    if (contract) {
      updateContract({ ...contract, status: 'pending' })
    }
  }, [state.contracts, updateContract])

  const markContractAsCancelled = useCallback((id) => {
    const contract = state.contracts.find(cont => cont.id === id)
    if (contract) {
      updateContract({ ...contract, status: 'cancelled' })
    }
  }, [state.contracts, updateContract])

  const nullifyContractValue = useCallback((id) => {
    const contract = state.contracts.find(cont => cont.id === id)
    if (contract) {
      updateContract({ 
        ...contract, 
        status: 'cancelled',
        totalValue: 0,
        hourlyRate: 0,
        estimatedHours: 0
      })
    }
  }, [state.contracts, updateContract])

  // Bulk actions with memoization
  const markAllInvoicesAsPaid = useCallback(() => {
    const updatedInvoices = state.invoices.map(invoice => 
      invoice.status === 'pending' || invoice.status === 'overdue' 
        ? { ...invoice, status: 'paid' }
        : invoice
    )
    dispatch({ type: 'BULK_UPDATE_INVOICES', payload: updatedInvoices })
  }, [state.invoices])

  // Archive functions with memoization
  const archiveContract = useCallback((id) => {
    const contract = state.contracts.find(c => c.id === id)
    if (contract) {
      setArchivedContracts(prev => [...prev, contract])
      deleteContract(id)
      debouncedSetItem('loomlance-archived-contracts', [...archivedContracts, contract])
    }
  }, [state.contracts, archivedContracts, deleteContract])

  const archiveInvoice = useCallback((id) => {
    const invoice = state.invoices.find(i => i.id === id)
    if (invoice) {
      setArchivedInvoices(prev => [...prev, invoice])
      deleteInvoice(id)
      debouncedSetItem('loomlance-archived-invoices', [...archivedInvoices, invoice])
    }
  }, [state.invoices, archivedInvoices, deleteInvoice])

  const archiveClient = useCallback((id) => {
    const client = state.clients.find(c => c.id === id)
    if (client) {
      setArchivedClients(prev => [...prev, client])
      deleteClient(id)
      debouncedSetItem('loomlance-archived-clients', [...archivedClients, client])
    }
  }, [state.clients, archivedClients, deleteClient])

  const restoreContract = useCallback((id) => {
    const contract = archivedContracts.find(c => c.id === id)
    if (contract) {
      setArchivedContracts(prev => prev.filter(c => c.id !== id))
      addContract(contract)
      debouncedSetItem('loomlance-archived-contracts', archivedContracts.filter(c => c.id !== id))
    }
  }, [archivedContracts, addContract])

  const restoreInvoice = useCallback((id) => {
    const invoice = archivedInvoices.find(i => i.id === id)
    if (invoice) {
      setArchivedInvoices(prev => prev.filter(i => i.id !== id))
      addInvoice(invoice)
      debouncedSetItem('loomlance-archived-invoices', archivedInvoices.filter(i => i.id !== id))
    }
  }, [archivedInvoices, addInvoice])

  const restoreClient = useCallback((id) => {
    const client = archivedClients.find(c => c.id === id)
    if (client) {
      setArchivedClients(prev => prev.filter(c => c.id !== id))
      addClient(client)
      debouncedSetItem('loomlance-archived-clients', archivedClients.filter(c => c.id !== id))
    }
  }, [archivedClients, addClient])

  // Memoized context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
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
    markContractAsCancelled,
    nullifyContractValue,
    // Bulk actions
    markAllInvoicesAsPaid,
    // Archive state
    archivedContracts,
    archivedInvoices,
    archivedClients,
    // Archive functions
    archiveContract,
    archiveInvoice,
    archiveClient,
    restoreContract,
    restoreInvoice,
    restoreClient,
  }), [
    state,
    addInvoice,
    updateInvoice,
    deleteInvoice,
    addContract,
    updateContract,
    deleteContract,
    addClient,
    updateClient,
    deleteClient,
    markInvoiceAsPaid,
    markInvoiceAsPending,
    markContractAsActive,
    markContractAsCompleted,
    markContractAsPending,
    markContractAsCancelled,
    nullifyContractValue,
    markAllInvoicesAsPaid,
    archivedContracts,
    archivedInvoices,
    archivedClients,
    archiveContract,
    archiveInvoice,
    archiveClient,
    restoreContract,
    restoreInvoice,
    restoreClient,
  ])

  return <DataContext.Provider value={contextValue}>{children}</DataContext.Provider>
}

export function useData() {
  const context = useContext(DataContext)
  if (!context) {
    throw new Error('useData must be used within a DataProvider')
  }
  return context
}

// Context selector hooks for specific data to prevent unnecessary re-renders
export const useInvoices = () => {
  const { invoices } = useData()
  return invoices
}

export const useContracts = () => {
  const { contracts } = useData()
  return contracts
}

export const useClients = () => {
  const { clients } = useData()
  return clients
}

export const useInvoiceActions = () => {
  const { addInvoice, updateInvoice, deleteInvoice, markInvoiceAsPaid, markInvoiceAsPending, markAllInvoicesAsPaid } = useData()
  return { addInvoice, updateInvoice, deleteInvoice, markInvoiceAsPaid, markInvoiceAsPending, markAllInvoicesAsPaid }
}

export const useContractActions = () => {
  const { addContract, updateContract, deleteContract, markContractAsActive, markContractAsCompleted, markContractAsPending, markContractAsCancelled, nullifyContractValue } = useData()
  return { addContract, updateContract, deleteContract, markContractAsActive, markContractAsCompleted, markContractAsPending, markContractAsCancelled, nullifyContractValue }
}

export const useClientActions = () => {
  const { addClient, updateClient, deleteClient } = useData()
  return { addClient, updateClient, deleteClient }
}

export const useArchiveData = () => {
  const { archivedContracts, archivedInvoices, archivedClients } = useData()
  return { archivedContracts, archivedInvoices, archivedClients }
}

export const useArchiveActions = () => {
  const { archiveContract, archiveInvoice, archiveClient, restoreContract, restoreInvoice, restoreClient } = useData()
  return { archiveContract, archiveInvoice, archiveClient, restoreContract, restoreInvoice, restoreClient }
}
