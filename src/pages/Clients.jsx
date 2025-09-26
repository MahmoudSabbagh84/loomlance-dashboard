import React, { useState } from 'react'
import { useData } from '../context/DataContext'
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

const Clients = () => {
  const { clients, addClient, updateClient, deleteClient } = useData()
  const { theme } = useTheme()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    address: ''
  })

  const handleSubmit = (e) => {
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
      address: ''
    })
  }

  const handleEdit = (client) => {
    setEditingClient(client)
    setFormData({
      name: client.name,
      email: client.email,
      phone: client.phone,
      company: client.company,
      address: client.address
    })
    setIsModalOpen(true)
  }

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this client?')) {
      deleteClient(id)
    }
  }

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
                address: ''
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
                    onClick={() => handleEdit(client)}
                    className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(client.id)}
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
                {client.address && (
                  <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                    <MapPin className="h-4 w-4 mr-2" />
                    <span className="truncate">{client.address}</span>
                  </div>
                )}
              </div>
              
              <div className="mt-4">
                <button className="text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300">
                  View Profile
                </button>
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
                            Business Address
                          </label>
                          <textarea
                            rows={3}
                            placeholder="Enter complete business address..."
                            className={combineThemeClasses("mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm", themeClasses.input)}
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                          />
                          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Include street address, city, state, and postal code
                          </p>
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
}

export default Clients
