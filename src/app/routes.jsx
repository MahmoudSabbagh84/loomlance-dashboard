import { createBrowserRouter, Outlet } from 'react-router-dom'
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
import VaultPage from '@/pages/VaultPage'
import PublicInvoicePage from '@/pages/PublicInvoicePage'
import PublicChangeRequestPage from '@/pages/PublicChangeRequestPage'
import PublicContractPage from '@/pages/PublicContractPage'
import NotFoundPage from '@/pages/NotFoundPage'
import AdminPulsePage from '@/pages/admin/AdminPulsePage'
import AdminPostsPage from '@/pages/admin/AdminPostsPage'
import AdminPostEditorPage from '@/pages/admin/AdminPostEditorPage'
import AdminUsersPage from '@/pages/admin/AdminUsersPage'
import AdminUserDetailPage from '@/pages/admin/AdminUserDetailPage'
import AdminToolsPage from '@/pages/admin/AdminToolsPage'
import AdminOpsPage from '@/pages/admin/AdminOpsPage'

export const router = createBrowserRouter([
  // Public
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/i/:token', element: <PublicInvoicePage /> },
  { path: '/cr/:token', element: <PublicChangeRequestPage /> },
  { path: '/c/:token', element: <PublicContractPage /> },

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
      { path: 'vault', element: <VaultPage /> },
      { path: 'profile', element: <ProfilePage /> },
      {
        path: 'admin',
        element: <AdminGate><Outlet /></AdminGate>,
        children: [
          { index: true, element: <AdminPulsePage /> },
          { path: 'posts', element: <AdminPostsPage /> },
          { path: 'posts/new', element: <AdminPostEditorPage /> },
          { path: 'posts/:id', element: <AdminPostEditorPage /> },
          { path: 'users', element: <AdminUsersPage /> },
          { path: 'users/:id', element: <AdminUserDetailPage /> },
          { path: 'tools', element: <AdminToolsPage /> },
          { path: 'ops', element: <AdminOpsPage /> },
        ],
      },
    ],
  },

  { path: '*', element: <NotFoundPage /> },
])
