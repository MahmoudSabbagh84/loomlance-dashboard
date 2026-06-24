import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAutosave, useAutosaveForm } from '@/hooks/useAutosave'

const tick = () => new Promise((r) => setTimeout(r, 0))

function makeWatch() {
  let cb
  const watch = (fn) => {
    cb = fn
    return { unsubscribe: () => {} }
  }
  return { watch, fire: (values, name) => cb(values, { name }) }
}

describe('autosave flush on unmount (LOO-15)', () => {
  it('useAutosave flushes a staged edit when unmounted before the debounce', async () => {
    const save = vi.fn().mockResolvedValue()
    const trigger = vi.fn().mockResolvedValue(true)
    const { watch, fire } = makeWatch()
    const { unmount } = renderHook(() =>
      useAutosave({ watch, trigger, save, fields: ['name'], debounceMs: 700, initial: { name: 'old' } })
    )
    fire({ name: 'new' }, 'name') // staged; debounce (700ms) has NOT fired
    unmount()
    await tick()
    expect(save).toHaveBeenCalledWith({ name: 'new' })
  })

  it('useAutosaveForm runs a pending commit when unmounted before the debounce', async () => {
    const commit = vi.fn().mockResolvedValue(undefined)
    const { watch, fire } = makeWatch()
    const { unmount } = renderHook(() => useAutosaveForm({ watch, commit, debounceMs: 700 }))
    fire({ name: 'x' }, 'name') // schedules a debounced commit
    unmount()
    await tick()
    expect(commit).toHaveBeenCalledTimes(1)
  })

  it('useAutosave does not save when nothing was staged', async () => {
    const save = vi.fn().mockResolvedValue()
    const { watch } = makeWatch()
    const { unmount } = renderHook(() =>
      useAutosave({ watch, trigger: vi.fn().mockResolvedValue(true), save, fields: ['name'] })
    )
    unmount()
    await tick()
    expect(save).not.toHaveBeenCalled()
  })

  it('useAutosave surfaces an invalid status when a staged field fails validation (LOO-24)', async () => {
    const save = vi.fn().mockResolvedValue()
    const trigger = vi.fn().mockResolvedValue(false) // field is invalid
    const { watch, fire } = makeWatch()
    const { result } = renderHook(() =>
      useAutosave({ watch, trigger, save, fields: ['name'], debounceMs: 1, initial: { name: 'old' } })
    )
    fire({ name: '' }, 'name')
    await waitFor(() => expect(result.current.status).toBe('invalid'))
    expect(save).not.toHaveBeenCalled()
  })
})
