import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useClient } from '@/hooks/useClients'
import { Tabs } from '@/components/ui/Tabs'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { Skeleton } from '@/components/ui/Skeleton'
import { ClientHeader } from '@/features/clients/ClientHeader'
import { OverviewTab } from '@/features/clients/tabs/OverviewTab'
import { ProjectsTab } from '@/features/clients/tabs/ProjectsTab'
import { ContractsTab } from '@/features/clients/tabs/ContractsTab'
import { InvoicesTab } from '@/features/clients/tabs/InvoicesTab'
import { ActivityTab } from '@/features/clients/tabs/ActivityTab'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'projects', label: 'Projects' },
  { key: 'contracts', label: 'Contracts' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'activity', label: 'Activity' },
]

export default function ClientDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: client, isLoading, error } = useClient(id)
  const [tab, setTab] = useState('overview')

  if (isLoading) return <Skeleton className="h-32" />
  if (error || !client) {
    return <p className="text-sm">Client not found. <button onClick={() => navigate('/clients')} className="text-primary underline">Back</button></p>
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Clients', to: '/clients' }, { label: client.name }]} />
      <ClientHeader client={client} />
      <Tabs value={tab} onChange={setTab} items={TABS} />
      <div className="pt-2">
        {tab === 'overview' && <OverviewTab client={client} />}
        {tab === 'projects' && <ProjectsTab clientId={client.id} />}
        {tab === 'contracts' && <ContractsTab clientId={client.id} />}
        {tab === 'invoices' && <InvoicesTab clientId={client.id} />}
        {tab === 'activity' && <ActivityTab clientId={client.id} />}
      </div>
    </div>
  )
}
