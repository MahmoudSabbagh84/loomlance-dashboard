import React, { Suspense, lazy, useMemo } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { DataProvider } from './context/DataContext.optimized'
import { SettingsProvider } from './context/SettingsContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import { LoadingSpinner } from './components/OptimizedComponents'
import { performanceMonitor } from './utils/performance'

// Lazy load pages for better performance
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Invoices = lazy(() => import('./pages/Invoices.optimized'))
const Contracts = lazy(() => import('./pages/Contracts'))
const Clients = lazy(() => import('./pages/Clients'))
const Archive = lazy(() => import('./pages/Archive'))
const Settings = lazy(() => import('./pages/Settings'))
const Profile = lazy(() => import('./pages/Profile'))
const Login = lazy(() => import('./pages/Login'))

// Preload critical components
const preloadCriticalComponents = () => {
  // Preload the most commonly used components
  import('./components/InvoiceModal')
  import('./components/InvoiceDetailsModal')
  import('./components/ContractDetailsModal')
}

// Optimized App component
const App = () => {
  // Start performance monitoring
  React.useEffect(() => {
    performanceMonitor.startTiming('app-initialization')
    
    // Preload critical components after initial render
    const timer = setTimeout(preloadCriticalComponents, 1000)
    
    return () => {
      clearTimeout(timer)
      performanceMonitor.endTiming('app-initialization')
    }
  }, [])

  // Memoized routes to prevent recreation
  const routes = useMemo(() => [
    {
      path: '/',
      element: (
        <ProtectedRoute>
          <Layout>
            <Dashboard />
          </Layout>
        </ProtectedRoute>
      )
    },
    {
      path: '/invoices',
      element: (
        <ProtectedRoute>
          <Layout>
            <Invoices />
          </Layout>
        </ProtectedRoute>
      )
    },
    {
      path: '/contracts',
      element: (
        <ProtectedRoute>
          <Layout>
            <Contracts />
          </Layout>
        </ProtectedRoute>
      )
    },
    {
      path: '/clients',
      element: (
        <ProtectedRoute>
          <Layout>
            <Clients />
          </Layout>
        </ProtectedRoute>
      )
    },
    {
      path: '/archive',
      element: (
        <ProtectedRoute>
          <Layout>
            <Archive />
          </Layout>
        </ProtectedRoute>
      )
    },
    {
      path: '/settings',
      element: (
        <ProtectedRoute>
          <Layout>
            <Settings />
          </Layout>
        </ProtectedRoute>
      )
    },
    {
      path: '/profile',
      element: (
        <ProtectedRoute>
          <Layout>
            <Profile />
          </Layout>
        </ProtectedRoute>
      )
    },
    {
      path: '/login',
      element: <Login />
    }
  ], [])

  // Memoized fallback component
  const FallbackComponent = useMemo(() => (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <LoadingSpinner size="lg" className="mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    </div>
  ), [])

  return (
    <ThemeProvider>
      <AuthProvider>
        <DataProvider>
          <SettingsProvider>
            <Router>
              <Suspense fallback={FallbackComponent}>
                <Routes>
                  {routes.map((route, index) => (
                    <Route
                      key={index}
                      path={route.path}
                      element={route.element}
                    />
                  ))}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </Router>
          </SettingsProvider>
        </DataProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
