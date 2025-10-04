import React, { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { themeClasses, combineThemeClasses } from '../styles/theme'
import { 
  LayoutDashboard, 
  FileText, 
  FileCheck, 
  Users, 
  Menu, 
  X,
  Settings,
  LogOut,
  User,
  ChevronDown,
  Sun,
  Moon
} from 'lucide-react'

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const dropdownRef = useRef(null)

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Invoices', href: '/invoices', icon: FileText },
    { name: 'Contracts', href: '/contracts', icon: FileCheck },
    { name: 'Clients', href: '/clients', icon: Users },
  ]

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(path)
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setAccountDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      logout()
      setAccountDropdownOpen(false)
    }
  }

  const handleProfileClick = () => {
    navigate('/profile')
    setAccountDropdownOpen(false)
  }

  const handleSettingsClick = () => {
    // For now, just close the dropdown
    // In the future, this could navigate to a settings page
    setAccountDropdownOpen(false)
    alert('Settings page coming soon!')
  }

  return (
    <div className={combineThemeClasses(themeClasses.background.primary)}>
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className={combineThemeClasses("fixed inset-y-0 left-0 flex w-64 flex-col shadow-xl", themeClasses.background.secondary)}>
          <div className="flex h-16 items-center justify-between px-4">
            <div className="flex items-center">
              <div className="flex h-20 w-20 items-center justify-center">
                <img 
                  src="/logo.png" 
                  alt="LoomLance Logo" 
                  className="h-20 w-20 object-contain"
                />
              </div>
              <span className="ml-2 text-xl font-bold">
                <span className="text-text-primary">Loom</span>
                <span className="text-text-muted">Lance</span>
              </span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="flex-1 px-4 py-4">
            <ul className="space-y-2">
              {navigation.map((item) => {
                const Icon = item.icon
                return (
                  <li key={item.name}>
                    <Link
                      to={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                        isActive(item.href)
                          ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                          : 'text-text-secondary dark:text-gray-300 hover:bg-bg-secondary dark:hover:bg-gray-700 hover:text-text-primary dark:hover:text-gray-100'
                      }`}
                    >
                      <Icon className="mr-3 h-5 w-5" />
                      {item.name}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center space-x-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100">
                <span className="text-sm font-medium text-primary-700">
                  {user?.name?.charAt(0) || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary dark:text-gray-100 truncate">
                  {user?.name || 'User'}
                </p>
                <p className="text-xs text-text-secondary dark:text-gray-400 truncate">
                  {user?.role || 'Freelancer'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
          <div className="flex h-16 items-center px-4">
            <div className="flex items-center">
              <div className="flex h-20 w-20 items-center justify-center">
                <img 
                  src="/logo.png" 
                  alt="LoomLance Logo" 
                  className="h-20 w-20 object-contain"
                />
              </div>
              <span className="ml-2 text-xl font-bold">
                <span className="text-text-primary">Loom</span>
                <span className="text-text-muted">Lance</span>
              </span>
            </div>
          </div>
          <nav className="flex-1 px-4 py-4">
            <ul className="space-y-2">
              {navigation.map((item) => {
                const Icon = item.icon
                return (
                  <li key={item.name}>
                    <Link
                      to={item.href}
                      className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                        isActive(item.href)
                          ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                          : 'text-text-secondary dark:text-gray-300 hover:bg-bg-secondary dark:hover:bg-gray-700 hover:text-text-primary dark:hover:text-gray-100'
                      }`}
                    >
                      <Icon className="mr-3 h-5 w-5" />
                      {item.name}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center space-x-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100">
                <span className="text-sm font-medium text-primary-700">
                  {user?.name?.charAt(0) || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary dark:text-gray-100 truncate">
                  {user?.name || 'User'}
                </p>
                <p className="text-xs text-text-secondary dark:text-gray-400 truncate">
                  {user?.role || 'Freelancer'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <button
            type="button"
            className="-m-2.5 p-2.5 text-gray-700 dark:text-gray-300 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex flex-1"></div>
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              <button 
                onClick={toggleTheme}
                className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400" 
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                {theme === 'dark' ? <Sun className="h-6 w-6" /> : <Moon className="h-6 w-6" />}
              </button>
              
              {/* Account Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
                  className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded-md p-1 dark:text-gray-300 dark:hover:text-gray-100"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100">
                    <span className="text-sm font-medium text-primary-700">
                      {user?.name?.charAt(0) || 'U'}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4" />
                </button>

                {/* Dropdown Menu */}
                {accountDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                    <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
                      <p className="text-sm font-medium text-text-primary dark:text-gray-100">{user?.name || 'User'}</p>
                    </div>
                    <button
                      onClick={handleProfileClick}
                      className="flex items-center w-full px-4 py-2 text-sm text-text-primary hover:bg-bg-secondary dark:text-gray-300 dark:hover:bg-gray-700 transition-colors duration-300"
                    >
                      <User className="h-4 w-4 mr-3" />
                      Profile
                    </button>
                    <button
                      onClick={handleSettingsClick}
                      className="flex items-center w-full px-4 py-2 text-sm text-text-primary hover:bg-bg-secondary dark:text-gray-300 dark:hover:bg-gray-700 transition-colors duration-300"
                    >
                      <Settings className="h-4 w-4 mr-3" />
                      Settings
                    </button>
                    <button
                      onClick={handleLogout}
                      className="flex items-center w-full px-4 py-2 text-sm text-text-primary hover:bg-bg-secondary dark:text-gray-300 dark:hover:bg-gray-700 transition-colors duration-300"
                    >
                      <LogOut className="h-4 w-4 mr-3" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

export default Layout
