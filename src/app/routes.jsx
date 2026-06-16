import { createBrowserRouter, Outlet } from 'react-router-dom'
import { AuthGate } from '@/features/auth/AuthGate'
import { AppShell } from '@/components/layout/AppShell'
import LoginPage from '@/pages/LoginPage'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'
import DashboardPage from '@/pages/DashboardPage'
import ClientsPage from '@/pages/ClientsPage'
import ClientDetailPage from '@/pages/ClientDetailPage'
import ProjectsPage from '@/pages/ProjectsPage'
import ProjectDetailPage from '@/pages/ProjectDetailPage'
import ContractsPage from '@/pages/ContractsPage'
import ContractDetailPage from '@/pages/ContractDetailPage'
import InvoicesPage from '@/pages/InvoicesPage'
import InvoiceDetailPage from '@/pages/InvoiceDetailPage'
import ProfilePage from '@/pages/ProfilePage'
import NotFoundPage from '@/pages/NotFoundPage'

export const router = createBrowserRouter([
  // Public
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },

  // Protected
  {
    path: '/',
    element: (
      <AuthGate>
        <AppShell>
          <Outlet />
        </AppShell>
      </AuthGate>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'clients', element: <ClientsPage /> },
      { path: 'clients/:id', element: <ClientDetailPage /> },
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'projects/:id', element: <ProjectDetailPage /> },
      { path: 'contracts', element: <ContractsPage /> },
      { path: 'contracts/:id', element: <ContractDetailPage /> },
      { path: 'invoices', element: <InvoicesPage /> },
      { path: 'invoices/:id', element: <InvoiceDetailPage /> },
      { path: 'profile', element: <ProfilePage /> },
    ],
  },

  { path: '*', element: <NotFoundPage /> },
])
