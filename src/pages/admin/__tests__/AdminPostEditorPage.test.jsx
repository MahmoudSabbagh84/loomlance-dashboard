// src/pages/admin/__tests__/AdminPostEditorPage.test.jsx — announce-in-app toggle rules
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AdminPostEditorPage from '../AdminPostEditorPage'
import { usePost, useCreatePost, useUpdatePost, useSetPostStatus } from '@/hooks/usePosts'

vi.mock('@/hooks/usePosts')
vi.mock('@/api/blogImages')
vi.mock('@/api/posts')

const basePost = {
  id: 'p1', title: 'Big Release', slug: 'big-release', category: 'release',
  excerpt: 'Something shipped.', body_md: '# hi', cover_image_url: null, external_url: null,
  status: 'draft', published_at: null, created_at: '2026-07-08T00:00:00Z', updated_at: '2026-07-08T00:00:00Z',
  announce_in_app: false, announced_at: null,
}
const idleMutation = () => ({ mutateAsync: vi.fn().mockResolvedValue({ id: 'p1' }), isPending: false })

function renderEditor() {
  return render(
    <MemoryRouter initialEntries={['/admin/posts/p1']}>
      <Routes>
        <Route path="/admin/posts/:id" element={<AdminPostEditorPage />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  useCreatePost.mockReturnValue(idleMutation())
  useUpdatePost.mockReturnValue(idleMutation())
  useSetPostStatus.mockReturnValue(idleMutation())
})

describe('AdminPostEditorPage — announce in-app', () => {
  it('shows the unchecked toggle for an unannounced release draft', () => {
    usePost.mockReturnValue({ data: basePost, isError: false })
    renderEditor()
    const box = screen.getByRole('checkbox', { name: /announce in-app/i })
    expect(box).not.toBeChecked()
  })
  it('hides the toggle for non-release categories', () => {
    usePost.mockReturnValue({ data: { ...basePost, category: 'update' }, isError: false })
    renderEditor()
    expect(screen.queryByRole('checkbox', { name: /announce in-app/i })).not.toBeInTheDocument()
  })
  it('replaces the toggle with an announced note once fanned out', () => {
    usePost.mockReturnValue({
      data: { ...basePost, announce_in_app: true, announced_at: '2026-07-08T01:00:00Z', status: 'published', published_at: '2026-07-08T01:00:00Z' },
      isError: false,
    })
    renderEditor()
    expect(screen.queryByRole('checkbox', { name: /announce in-app/i })).not.toBeInTheDocument()
    expect(screen.getByText(/Announced/)).toBeInTheDocument()
  })
  it('saving with the box checked includes announce_in_app in the patch', async () => {
    const update = idleMutation()
    useUpdatePost.mockReturnValue(update)
    usePost.mockReturnValue({ data: basePost, isError: false })
    renderEditor()
    await userEvent.click(screen.getByRole('checkbox', { name: /announce in-app/i }))
    await userEvent.click(screen.getByRole('button', { name: /save draft/i }))
    expect(update.mutateAsync).toHaveBeenCalledWith({
      id: 'p1',
      patch: expect.objectContaining({ announce_in_app: true }),
    })
  })
  it('warns that saving announces immediately on an already-published post', () => {
    usePost.mockReturnValue({
      data: { ...basePost, status: 'published', published_at: '2026-07-08T01:00:00Z' },
      isError: false,
    })
    renderEditor()
    expect(screen.getByText(/already live — saving will notify every user immediately/)).toBeInTheDocument()
  })
  it('switching category away from release clears the flag in the next save', async () => {
    const update = idleMutation()
    useUpdatePost.mockReturnValue(update)
    usePost.mockReturnValue({ data: { ...basePost, announce_in_app: true }, isError: false })
    renderEditor()
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'update')
    await userEvent.click(screen.getByRole('button', { name: /save draft/i }))
    expect(update.mutateAsync).toHaveBeenCalledWith({
      id: 'p1',
      patch: expect.objectContaining({ announce_in_app: false }),
    })
  })
})
