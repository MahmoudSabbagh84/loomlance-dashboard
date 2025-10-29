import React, { useState, useMemo, useCallback, memo, useTransition, useDeferredValue } from 'react'
import { useClients, useClientActions } from '../context/DataContext'
import { useTheme } from '../context/ThemeContext'
import { themeClasses, combineThemeClasses } from '../styles/theme'
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye,
  Mail,
  Phone,
  MapPin
} from 'lucide-react'

const Clients = memo(() => {
  const clients = useClients()
  const { addClient, updateClient, deleteClient } = useClientActions()
  const { theme } = useTheme()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [isPending, startTransition] = useTransition()
  
  // Defer search term for better performance
  const deferredSearchTerm = useDeferredValue(searchTerm)

  // Memoized filtered clients
  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      const matchesSearch = !deferredSearchTerm || 
        client.name?.toLowerCase().includes(deferredSearchTerm.toLowerCase()) ||
        client.email?.toLowerCase().includes(deferredSearchTerm.toLowerCase()) ||
        client.company?.toLowerCase().includes(deferredSearchTerm.toLowerCase()) ||
        client.city?.toLowerCase().includes(deferredSearchTerm.toLowerCase())
      
      return matchesSearch
    })
  }, [clients, deferredSearchTerm])

  // Memoized statistics
  const statistics = useMemo(() => {
    const totalClients = clients.length
    const clientsWithContracts = clients.filter(client => 
      client.contracts && client.contracts.length > 0
    ).length
    const clientsWithInvoices = clients.filter(client => 
      client.invoices && client.invoices.length > 0
    ).length

    return {
      totalClients,
      clientsWithContracts,
      clientsWithInvoices
    }
  }, [clients])

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    streetAddress: '',
    city: '',
    state: '',
    zipCode: ''
  })

  const handleSubmit = useCallback((e) => {
    e.preventDefault()
    const client = {
      ...formData,
      id: editingClient?.id || Date.now(),
      createdAt: editingClient?.createdAt || new Date().toISOString()
    }

    if (editingClient) {
      updateClient(client)
    } else {
      addClient(client)
    }

    setIsModalOpen(false)
    setEditingClient(null)
    setFormData({
      name: '',
      email: '',
      phone: '',
      company: '',
      streetAddress: '',
      city: '',
      state: '',
      zipCode: ''
    })
  }, [formData, editingClient, updateClient, addClient])

  const handleEdit = useCallback((client) => {
    setEditingClient(client)
    setFormData({
      name: client.name,
      email: client.email,
      phone: client.phone,
      company: client.company,
      streetAddress: client.streetAddress || '',
      city: client.city || '',
      state: client.state || '',
      zipCode: client.zipCode || ''
    })
    setIsModalOpen(true)
  }, [])

  const handleDelete = useCallback((id) => {
    if (window.confirm('Are you sure you want to delete this client?')) {
      deleteClient(id)
    }
  }, [deleteClient])

  const handleSearchChange = useCallback((e) => {
    startTransition(() => {
      setSearchTerm(e.target.value)
    })
  }, [])

  const handleCreateNew = useCallback(() => {
    setEditingClient(null)
    setIsModalOpen(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false)
    setEditingClient(null)
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Clients
          </h1>
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
            Manage your client relationships
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <button
            type="button"
            onClick={() => {
              setEditingClient(null)
              setFormData({
                name: '',
                email: '',
                phone: '',
                company: '',
                streetAddress: '',
                city: '',
                state: '',
                zipCode: ''
              })
              setIsModalOpen(true)
            }}
            className={combineThemeClasses("block rounded-md bg-primary-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600", themeClasses.button.primary)}
          >
            <Plus className="h-4 w-4 inline mr-2" />
            Add Client
          </button>
        </div>
      </div>

      {/* Client Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {clients.map((client) => (
          <div key={client.id} className={combineThemeClasses("bg-white overflow-hidden shadow rounded-lg", themeClasses.card)}>
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate">
                    {client.name}
                  </h3>
                  {client.company && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {client.company}
                    </p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleEdit(client)
                    }}
                    className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(client.id)
                    }}
                    className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              <div className="mt-4 space-y-2">
                {client.email && (
                  <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                    <Mail className="h-4 w-4 mr-2" />
                    <span className="truncate">{client.email}</span>
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                    <Phone className="h-4 w-4 mr-2" />
                    <span className="truncate">{client.phone}</span>
                  </div>
                )}
                {(client.streetAddress || client.city || client.state || client.zipCode) && (
                  <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                    <MapPin className="h-4 w-4 mr-2" />
                    <span className="truncate">
                      {[client.streetAddress, client.city, client.state, client.zipCode].filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}
              </div>
              
            </div>
          </div>
        ))}
        
        {clients.length === 0 && (
          <div className="col-span-full text-center py-12">
            <div className="text-gray-500 dark:text-gray-400">
              <Users className="mx-auto h-12 w-12" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No clients</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Get started by adding your first client.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className={combineThemeClasses("flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0", themeClasses.modal.overlay)}>
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsModalOpen(false)} />
            <div className="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle dark:bg-gray-800">
              <form onSubmit={handleSubmit}>
                <div className={combineThemeClasses("px-4 pt-5 pb-4 sm:p-6 sm:pb-4", themeClasses.modal.header)}>
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                      <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
                        {editingClient ? 'Edit Client' : 'Add Client'}
                      </h3>
                      <div className="mt-4 space-y-6">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <label className={combineThemeClasses("block text-sm font-medium", themeClasses.form.label)}>
                              Full Name <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="Enter client's full name"
                              className={combineThemeClasses("mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm", themeClasses.input)}
                              value={formData.name}
                              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className={combineThemeClasses("block text-sm font-medium", themeClasses.form.label)}>
                              Company
                            </label>
                            <input
                              type="text"
                              placeholder="Company name (optional)"
                              className={combineThemeClasses("mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm", themeClasses.input)}
                              value={formData.company}
                              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                            />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <label className={combineThemeClasses("block text-sm font-medium", themeClasses.form.label)}>
                              Email Address
                            </label>
                            <input
                              type="email"
                              placeholder="client@company.com"
                              className={combineThemeClasses("mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm", themeClasses.input)}
                              value={formData.email}
                              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className={combineThemeClasses("block text-sm font-medium", themeClasses.form.label)}>
                              Phone Number
                            </label>
                            <input
                              type="tel"
                              placeholder="+1 (555) 123-4567"
                              className={combineThemeClasses("mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm", themeClasses.input)}
                              value={formData.phone}
                              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            />
                          </div>
                        </div>
                        
                        <div>
                          <label className={combineThemeClasses("block text-sm font-medium", themeClasses.form.label)}>
                            Street Address
                          </label>
                          <input
                            type="text"
                            placeholder="123 Main Street"
                            className={combineThemeClasses("mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm", themeClasses.input)}
                            value={formData.streetAddress}
                            onChange={(e) => setFormData({ ...formData, streetAddress: e.target.value })}
                          />
                        </div>
                        
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <label className={combineThemeClasses("block text-sm font-medium", themeClasses.form.label)}>
                              City
                            </label>
                            <input
                              type="text"
                              placeholder="City"
                              className={combineThemeClasses("mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm", themeClasses.input)}
                              value={formData.city}
                              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className={combineThemeClasses("block text-sm font-medium", themeClasses.form.label)}>
                              State
                            </label>
                            <select
                              className={combineThemeClasses("mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm", themeClasses.input)}
                              value={formData.state}
                              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                            >
                              <option value="">Select State</option>
                              <option value="AL">Alabama</option>
                              <option value="AK">Alaska</option>
                              <option value="AZ">Arizona</option>
                              <option value="AR">Arkansas</option>
                              <option value="CA">California</option>
                              <option value="CO">Colorado</option>
                              <option value="CT">Connecticut</option>
                              <option value="DE">Delaware</option>
                              <option value="FL">Florida</option>
                              <option value="GA">Georgia</option>
                              <option value="HI">Hawaii</option>
                              <option value="ID">Idaho</option>
                              <option value="IL">Illinois</option>
                              <option value="IN">Indiana</option>
                              <option value="IA">Iowa</option>
                              <option value="KS">Kansas</option>
                              <option value="KY">Kentucky</option>
                              <option value="LA">Louisiana</option>
                              <option value="ME">Maine</option>
                              <option value="MD">Maryland</option>
                              <option value="MA">Massachusetts</option>
                              <option value="MI">Michigan</option>
                              <option value="MN">Minnesota</option>
                              <option value="MS">Mississippi</option>
                              <option value="MO">Missouri</option>
                              <option value="MT">Montana</option>
                              <option value="NE">Nebraska</option>
                              <option value="NV">Nevada</option>
                              <option value="NH">New Hampshire</option>
                              <option value="NJ">New Jersey</option>
                              <option value="NM">New Mexico</option>
                              <option value="NY">New York</option>
                              <option value="NC">North Carolina</option>
                              <option value="ND">North Dakota</option>
                              <option value="OH">Ohio</option>
                              <option value="OK">Oklahoma</option>
                              <option value="OR">Oregon</option>
                              <option value="PA">Pennsylvania</option>
                              <option value="RI">Rhode Island</option>
                              <option value="SC">South Carolina</option>
                              <option value="SD">South Dakota</option>
                              <option value="TN">Tennessee</option>
                              <option value="TX">Texas</option>
                              <option value="UT">Utah</option>
                              <option value="VT">Vermont</option>
                              <option value="VA">Virginia</option>
                              <option value="WA">Washington</option>
                              <option value="WV">West Virginia</option>
                              <option value="WI">Wisconsin</option>
                              <option value="WY">Wyoming</option>
                              <option value="DC">District of Columbia</option>
                              <option value="AS">American Samoa</option>
                              <option value="GU">Guam</option>
                              <option value="MP">Northern Mariana Islands</option>
                              <option value="PR">Puerto Rico</option>
                              <option value="VI">U.S. Virgin Islands</option>
                            </select>
                          </div>
                        </div>
                        
                        <div>
                          <label className={combineThemeClasses("block text-sm font-medium", themeClasses.form.label)}>
                            ZIP Code
                          </label>
                          <input
                            type="text"
                            placeholder="12345"
                            pattern="[0-9]{5}(-[0-9]{4})?"
                            className={combineThemeClasses("mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm", themeClasses.input)}
                            value={formData.zipCode}
                            onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className={combineThemeClasses("px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6", themeClasses.modal.footer)}>
                  <button
                    type="submit"
                    className={combineThemeClasses("inline-flex w-full justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm", themeClasses.button.primary)}
                  >
                    {editingClient ? 'Update' : 'Add'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className={combineThemeClasses("mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600", themeClasses.button.secondary)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

Clients.displayName = 'Clients'

export default Clients
