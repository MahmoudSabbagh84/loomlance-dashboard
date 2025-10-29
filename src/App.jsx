import React, { Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import ErrorBoundary, { SuspenseWithErrorBoundary } from './components/ErrorBoundary'
import { DataProvider } from './context/DataContext'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { SettingsProvider } from './context/SettingsContext'

// Lazy load page components for better performance
const Dashboard = React.lazy(() => import('./pages/Dashboard'))
const Invoices = React.lazy(() => import('./pages/Invoices'))
const Contracts = React.lazy(() => import('./pages/Contracts'))
const Clients = React.lazy(() => import('./pages/Clients'))
const Profile = React.lazy(() => import('./pages/Profile'))
const Settings = React.lazy(() => import('./pages/Settings'))
const Archive = React.lazy(() => import('./pages/Archive'))
const Login = React.lazy(() => import('./pages/Login'))

// Loading component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
  </div>
)

function App() {
  return (
    <ErrorBoundary showDetails={process.env.NODE_ENV === 'development'}>
      <ThemeProvider>
        <AuthProvider>
          <DataProvider>
            <SettingsProvider>
              <Router>
                <Routes>
                  <Route path="/login" element={
                    <SuspenseWithErrorBoundary fallback={<LoadingSpinner />}>
                      <Login />
                    </SuspenseWithErrorBoundary>
                  } />
                  <Route path="/" element={
                    <ProtectedRoute>
                      <Layout>
                        <SuspenseWithErrorBoundary fallback={<LoadingSpinner />}>
                          <Dashboard />
                        </SuspenseWithErrorBoundary>
                      </Layout>
                    </ProtectedRoute>
                  } />
                  <Route path="/invoices" element={
                    <ProtectedRoute>
                      <Layout>
                        <SuspenseWithErrorBoundary fallback={<LoadingSpinner />}>
                          <Invoices />
                        </SuspenseWithErrorBoundary>
                      </Layout>
                    </ProtectedRoute>
                  } />
                  <Route path="/contracts" element={
                    <ProtectedRoute>
                      <Layout>
                        <SuspenseWithErrorBoundary fallback={<LoadingSpinner />}>
                          <Contracts />
                        </SuspenseWithErrorBoundary>
                      </Layout>
                    </ProtectedRoute>
                  } />
                  <Route path="/clients" element={
                    <ProtectedRoute>
                      <Layout>
                        <SuspenseWithErrorBoundary fallback={<LoadingSpinner />}>
                          <Clients />
                        </SuspenseWithErrorBoundary>
                      </Layout>
                    </ProtectedRoute>
                  } />
                  <Route path="/profile" element={
                    <ProtectedRoute>
                      <Layout>
                        <SuspenseWithErrorBoundary fallback={<LoadingSpinner />}>
                          <Profile />
                        </SuspenseWithErrorBoundary>
                      </Layout>
                    </ProtectedRoute>
                  } />
                  <Route path="/settings" element={
                    <ProtectedRoute>
                      <Layout>
                        <SuspenseWithErrorBoundary fallback={<LoadingSpinner />}>
                          <Settings />
                        </SuspenseWithErrorBoundary>
                      </Layout>
                    </ProtectedRoute>
                  } />
                  <Route path="/archive" element={
                    <ProtectedRoute>
                      <Layout>
                        <SuspenseWithErrorBoundary fallback={<LoadingSpinner />}>
                          <Archive />
                        </SuspenseWithErrorBoundary>
                      </Layout>
                    </ProtectedRoute>
                  } />
                </Routes>
              </Router>
            </SettingsProvider>
          </DataProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
