import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { themeClasses, combineThemeClasses } from '../styles/theme'
import { LogIn, Eye, EyeOff } from 'lucide-react'

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const { theme } = useTheme()
  const navigate = useNavigate()

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')

    // Simple validation
    if (!formData.email || !formData.password) {
      setError('Please fill in all fields')
      return
    }

    // Demo login - in a real app, this would be an API call
    if (formData.email === 'demo@loomlance.com' && formData.password === 'demo123') {
      const user = {
        id: 1,
        name: 'Demo User',
        email: 'demo@loomlance.com',
        role: 'Freelancer',
        company: 'Demo Company',
        phone: '+1 (555) 123-4567',
        address: '123 Demo Street, Demo City, DC 12345'
      }
      login(user)
      navigate('/')
    } else {
      setError('Invalid credentials. Use demo@loomlance.com / demo123')
    }
  }

  return (
    <div className={combineThemeClasses("min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8", themeClasses.background.primary)}>
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="flex h-32 w-32 items-center justify-center">
              <img 
                src="/logo.png" 
                alt="LoomLance Logo" 
                className="h-32 w-32 object-contain"
              />
            </div>
          </div>
          <h2 className="text-3xl font-bold">
            <span className="text-text-primary">Loom</span>
            <span className="text-text-muted">Lance</span>
          </h2>
          <p className="mt-2 text-sm text-text-secondary dark:text-gray-400">
            Weave it all together
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className={combineThemeClasses("block text-sm font-medium", themeClasses.form.label)}>
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className={combineThemeClasses("mt-1 appearance-none relative block w-full px-3 py-2 border rounded-md placeholder-gray-500 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm", themeClasses.input)}
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleChange}
              />
            </div>
            
            <div>
              <label htmlFor="password" className={combineThemeClasses("block text-sm font-medium", themeClasses.form.label)}>
                Password
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className={combineThemeClasses("appearance-none relative block w-full px-3 py-2 pr-10 border rounded-md placeholder-gray-500 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm", themeClasses.input)}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-text-muted dark:text-gray-500" />
                  ) : (
                    <Eye className="h-5 w-5 text-text-muted dark:text-gray-500" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-error-50 dark:bg-error-900/20 p-4 border border-error-200 dark:border-error-800">
              <div className="text-sm text-error-600 dark:text-error-300">
                {error}
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              className={combineThemeClasses("group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-500 hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500", themeClasses.button.primary)}
            >
              <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                <LogIn className="h-5 w-5 text-primary-500 group-hover:text-primary-400" />
              </span>
              Sign in
            </button>
          </div>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-600" />
              </div>
              <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-darkMode-background text-text-secondary dark:text-gray-400">
                Demo Credentials
              </span>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
              <p className="text-sm text-primary-800 dark:text-primary-200 text-center">
                <strong>Email:</strong> demo@loomlance.com<br />
                <strong>Password:</strong> demo123
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Login
