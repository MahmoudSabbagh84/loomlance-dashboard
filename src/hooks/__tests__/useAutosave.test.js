import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAutosave, useAutosaveForm } from '../useAutosave'

// Fake RHF `watch`: capture the subscriber and let tests emit changes.
function makeWatch() {
  let cb = null
  const watch = (fn) => {
    cb = fn
    return { unsubscribe: () => { cb = null } }
  }
  const emit = (values, name) => cb && cb(values, { name })
  return { watch, emit }
}

function deferred() {
  let resolve, reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('useAutosave', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('debounces rapid changes into a single save with the latest value', async () => {
    const { watch, emit } = makeWatch()
    const save = vi.fn().mockResolvedValue()
    const trigger = vi.fn().mockResolvedValue(true)
    const { result } = renderHook(() =>
      useAutosave({ watch, trigger, save, fields: ['name'], debounceMs: 700, initial: { name: 'a' } })
    )

    act(() => { emit({ name: 'ab' }, 'name') })
    act(() => { emit({ name: 'abc' }, 'name') })
    await act(async () => { await vi.advanceTimersByTimeAsync(700) })

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith({ name: 'abc' })
    expect(result.current.status).toBe('saved')
  })

  it('does not persist a field that fails validation', async () => {
    const { watch, emit } = makeWatch()
    const save = vi.fn().mockResolvedValue()
    const trigger = vi.fn().mockResolvedValue(false) // invalid
    renderHook(() => useAutosave({ watch, trigger, save, fields: ['name'], debounceMs: 100 }))

    act(() => { emit({ name: '' }, 'name') })
    await act(async () => { await vi.advanceTimersByTimeAsync(100) })

    expect(save).not.toHaveBeenCalled()
  })

  it('ignores fields not in the tracked list', async () => {
    const { watch, emit } = makeWatch()
    const save = vi.fn().mockResolvedValue()
    const trigger = vi.fn().mockResolvedValue(true)
    renderHook(() => useAutosave({ watch, trigger, save, fields: ['name'], debounceMs: 100 }))

    act(() => { emit({ secret: 'x' }, 'secret') })
    await act(async () => { await vi.advanceTimersByTimeAsync(100) })

    expect(save).not.toHaveBeenCalled()
  })

  it('serializes writes: a change during an in-flight save runs after it', async () => {
    const { watch, emit } = makeWatch()
    const first = deferred()
    const save = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => Promise.resolve())
    const trigger = vi.fn().mockResolvedValue(true)
    renderHook(() => useAutosave({ watch, trigger, save, fields: ['name'], debounceMs: 100 }))

    act(() => { emit({ name: 'one' }, 'name') })
    await act(async () => { await vi.advanceTimersByTimeAsync(100) }) // first save starts, stays in-flight
    expect(save).toHaveBeenCalledTimes(1)

    // New change lands while first is still in-flight.
    act(() => { emit({ name: 'two' }, 'name') })
    await act(async () => { await vi.advanceTimersByTimeAsync(100) })
    expect(save).toHaveBeenCalledTimes(1) // still blocked

    await act(async () => { first.resolve(); await vi.advanceTimersByTimeAsync(0) })
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenNthCalledWith(1, { name: 'one' })
    expect(save).toHaveBeenNthCalledWith(2, { name: 'two' })
  })

  it('retains a failed patch and retry() re-saves it', async () => {
    const { watch, emit } = makeWatch()
    const save = vi.fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce()
    const trigger = vi.fn().mockResolvedValue(true)
    const { result } = renderHook(() =>
      useAutosave({ watch, trigger, save, fields: ['name'], debounceMs: 100 })
    )

    act(() => { emit({ name: 'x' }, 'name') })
    await act(async () => { await vi.advanceTimersByTimeAsync(100) })
    expect(result.current.status).toBe('error')
    expect(save).toHaveBeenCalledTimes(1)

    await act(async () => { result.current.retry(); await vi.advanceTimersByTimeAsync(0) })
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith({ name: 'x' })
    expect(result.current.status).toBe('saved')
  })

  it('skips no-op changes equal to the last saved value', async () => {
    const { watch, emit } = makeWatch()
    const save = vi.fn().mockResolvedValue()
    const trigger = vi.fn().mockResolvedValue(true)
    renderHook(() =>
      useAutosave({ watch, trigger, save, fields: ['name'], debounceMs: 100, initial: { name: 'same' } })
    )

    act(() => { emit({ name: 'same' }, 'name') })
    await act(async () => { await vi.advanceTimersByTimeAsync(100) })

    expect(save).not.toHaveBeenCalled()
  })
})

describe('useAutosaveForm', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('debounces changes into a single commit', async () => {
    const { watch, emit } = makeWatch()
    const commit = vi.fn().mockResolvedValue()
    const { result } = renderHook(() => useAutosaveForm({ watch, commit, debounceMs: 200 }))

    act(() => { emit({}, 'a') })
    act(() => { emit({}, 'b') })
    await act(async () => { await vi.advanceTimersByTimeAsync(200) })

    expect(commit).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('saved')
  })

  it('ignores programmatic changes with no field name', async () => {
    const { watch, emit } = makeWatch()
    const commit = vi.fn().mockResolvedValue()
    renderHook(() => useAutosaveForm({ watch, commit, debounceMs: 100 }))

    act(() => { emit({}, undefined) })
    await act(async () => { await vi.advanceTimersByTimeAsync(100) })

    expect(commit).not.toHaveBeenCalled()
  })

  it('treats commit()===false as held (no error, status idle)', async () => {
    const { watch, emit } = makeWatch()
    const commit = vi.fn().mockResolvedValue(false)
    const { result } = renderHook(() => useAutosaveForm({ watch, commit, debounceMs: 100 }))

    act(() => { emit({}, 'a') })
    await act(async () => { await vi.advanceTimersByTimeAsync(100) })

    expect(commit).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('idle')
  })

  it('serializes: a change during an in-flight commit re-runs after it', async () => {
    const { watch, emit } = makeWatch()
    const first = deferred()
    const commit = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => Promise.resolve())
    renderHook(() => useAutosaveForm({ watch, commit, debounceMs: 100 }))

    act(() => { emit({}, 'a') })
    await act(async () => { await vi.advanceTimersByTimeAsync(100) })
    expect(commit).toHaveBeenCalledTimes(1)

    act(() => { emit({}, 'b') })
    await act(async () => { await vi.advanceTimersByTimeAsync(100) })
    expect(commit).toHaveBeenCalledTimes(1) // blocked by in-flight

    await act(async () => { first.resolve(); await vi.advanceTimersByTimeAsync(0) })
    expect(commit).toHaveBeenCalledTimes(2)
  })

  it('surfaces an error and retry() re-commits', async () => {
    const { watch, emit } = makeWatch()
    const commit = vi.fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce()
    const { result } = renderHook(() => useAutosaveForm({ watch, commit, debounceMs: 100 }))

    act(() => { emit({}, 'a') })
    await act(async () => { await vi.advanceTimersByTimeAsync(100) })
    expect(result.current.status).toBe('error')

    await act(async () => { result.current.retry(); await vi.advanceTimersByTimeAsync(0) })
    expect(commit).toHaveBeenCalledTimes(2)
    expect(result.current.status).toBe('saved')
  })
})
