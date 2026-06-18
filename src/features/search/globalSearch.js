import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

export async function searchEverything(query) {
  const q = (query || '').trim()
  if (!q) return []
  const like = `%${q}%`

  const [clients, projects, invoices] = await Promise.all([
    supabase.from('clients').select('id, name, company').or(`name.ilike.${like},company.ilike.${like}`).is('archived_at', null).limit(5),
    supabase.from('projects').select('id, name, clients(name)').ilike('name', like).is('archived_at', null).limit(5),
    supabase.from('invoices').select('id, invoice_number, status, clients(name)').ilike('invoice_number', like).limit(5),
  ])
  for (const r of [clients, projects, invoices]) if (r.error) throw mapPostgresError(r.error)

  const results = []
  for (const c of clients.data || []) {
    results.push({ type: 'Client', id: c.id, title: c.name, subtitle: c.company || '', to: `/clients/${c.id}` })
  }
  for (const p of projects.data || []) {
    results.push({ type: 'Project', id: p.id, title: p.name, subtitle: p.clients?.name || '', to: `/projects/${p.id}` })
  }
  for (const i of invoices.data || []) {
    results.push({
      type: 'Invoice',
      id: i.id,
      title: i.invoice_number,
      subtitle: [i.status, i.clients?.name].filter(Boolean).join(' · '),
      to: `/invoices/${i.id}`,
    })
  }
  return results
}
