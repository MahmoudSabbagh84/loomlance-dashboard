import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { themeClasses, combineThemeClasses } from '../styles/theme'
import { User, Mail, Phone, Building, MapPin, Save } from 'lucide-react'

const Profile = () => {
  const { user, updateUser } = useAuth()
  const { theme } = useTheme()
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    company: user?.company || '',
    address: user?.address || '',
    role: user?.role || 'Freelancer'
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    updateUser(formData)
    setIsEditing(false)
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleCancel = () => {
    setFormData({
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      company: user?.company || '',
      address: user?.address || '',
      role: user?.role || 'Freelancer'
    })
    setIsEditing(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold leading-7 text-gray-900 dark:text-white sm:truncate sm:text-3xl sm:tracking-tight">
            Profile
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage your personal information and preferences
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          {!isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className={combineThemeClasses("inline-flex items-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600", themeClasses.button.primary)}
            >
              <User className="h-4 w-4 mr-2" />
              Edit Profile
            </button>
          ) : (
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={handleCancel}
                className={combineThemeClasses("inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600", themeClasses.button.secondary)}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className={combineThemeClasses("inline-flex items-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600", themeClasses.button.primary)}
              >
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Profile Card */}
      <div className={combineThemeClasses("bg-white shadow rounded-lg", themeClasses.card)}>
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center space-x-4 mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100">
              <span className="text-2xl font-medium text-primary-700">
                {user?.name?.charAt(0) || 'U'}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {user?.name || 'User'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {user?.role || 'Freelancer'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className={combineThemeClasses("block text-sm font-medium", themeClasses.form.label)}>
                  Full Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className={combineThemeClasses("mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm", themeClasses.input)}
                  />
                ) : (
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {user?.name || 'Not provided'}
                  </p>
                )}
              </div>

              <div>
                <label className={combineThemeClasses("block text-sm font-medium", themeClasses.form.label)}>
                  Email
                </label>
                {isEditing ? (
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={combineThemeClasses("mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm", themeClasses.input)}
                  />
                ) : (
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {user?.email || 'Not provided'}
                  </p>
                )}
              </div>

              <div>
                <label className={combineThemeClasses("block text-sm font-medium", themeClasses.form.label)}>
                  Phone
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className={combineThemeClasses("mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm", themeClasses.input)}
                  />
                ) : (
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {user?.phone || 'Not provided'}
                  </p>
                )}
              </div>

              <div>
                <label className={combineThemeClasses("block text-sm font-medium", themeClasses.form.label)}>
                  Company
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    className={combineThemeClasses("mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm", themeClasses.input)}
                  />
                ) : (
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {user?.company || 'Not provided'}
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className={combineThemeClasses("block text-sm font-medium", themeClasses.form.label)}>
                  Address
                </label>
                {isEditing ? (
                  <textarea
                    rows={3}
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className={combineThemeClasses("mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm", themeClasses.input)}
                  />
                ) : (
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {user?.address || 'Not provided'}
                  </p>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Profile
