import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { AuthGate } from '@/features/auth/AuthGate'
import { AdminGate } from '@/features/admin/AdminGate'
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
import RecurringInvoicesPage from '@/pages/RecurringInvoicesPage'
import TimePage from '@/pages/TimePage'
import ExpensesPage from '@/pages/ExpensesPage'
import ReportsPage from '@/pages/ReportsPage'
import ProfilePage from '@/pages/ProfilePage'
import PublicInvoicePage from '@/pages/PublicInvoicePage'
import NotFoundPage from '@/pages/NotFoundPage'
import AdminPostsPage from '@/pages/admin/AdminPostsPage'
import AdminPostEditorPage from '@/pages/admin/AdminPostEditorPage'
import AdminToolsPage from '@/pages/admin/AdminToolsPage'

export const router = createBrowserRouter([
  // Public
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/i/:token', element: <PublicInvoicePage /> },

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
      { path: 'invoices/recurring', element: <RecurringInvoicesPage /> },
      { path: 'invoices/:id', element: <InvoiceDetailPage /> },
      { path: 'time', element: <TimePage /> },
      { path: 'expenses', element: <ExpensesPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'profile', element: <ProfilePage /> },
      {
        path: 'admin',
        element: <AdminGate><Outlet /></AdminGate>,
        children: [
          { index: true, element: <Navigate to="/admin/posts" replace /> },
          { path: 'posts', element: <AdminPostsPage /> },
          { path: 'posts/new', element: <AdminPostEditorPage /> },
          { path: 'posts/:id', element: <AdminPostEditorPage /> },
          { path: 'tools', element: <AdminToolsPage /> },
        ],
      },
    ],
  },

  { path: '*', element: <NotFoundPage /> },
])
