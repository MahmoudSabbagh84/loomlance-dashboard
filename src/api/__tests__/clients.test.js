import { describe, it, expect, vi, beforeEach } from 'vitest'

const orMock = vi.fn()
const orderMock = vi.fn()
const rangeMock = vi.fn()
const isMock = vi.fn()
const selectMock = vi.fn()
const fromMock = vi.fn()

vi.mock('@/lib/supabase', () => {
  const chain = {
    select: (...a) => { selectMock(...a); return chain },
    is: (...a) => { isMock(...a); return chain },
    or: (...a) => { orMock(...a); return chain },
    order: (...a) => { orderMock(...a); return chain },
    range: (...a) => { rangeMock(...a); return Promise.resolve({ data: [], error: null, count: 0 }) },
  }
  return {
    supabase: {
      from: (...a) => { fromMock(...a); return chain },
      auth: { getSession: async () => ({ session: { user: { id: 'u1' } } }) },
    },
  }
})

import { listClients } from '@/api/clients'

describe('listClients', () => {
  beforeEach(() => {
    orMock.mockClear(); orderMock.mockClear(); rangeMock.mockClear(); isMock.mockClear(); selectMock.mockClear(); fromMock.mockClear()
  })

  it('filters out archived by default', async () => {
    await listClients()
    expect(isMock).toHaveBeenCalledWith('archived_at', null)
  })

  it('builds an OR ilike query for search', async () => {
    await listClients({ search: 'acme' })
    const arg = orMock.mock.calls[0][0]
    expect(arg).toMatch(/name\.ilike\.%acme%/)
    expect(arg).toMatch(/company\.ilike\.%acme%/)
    expect(arg).toMatch(/email\.ilike\.%acme%/)
  })

  it('uses page/pageSize for range', async () => {
    await listClients({ page: 2, pageSize: 10 })
    expect(rangeMock).toHaveBeenCalledWith(20, 29)
  })
})
