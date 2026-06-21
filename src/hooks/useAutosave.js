import { useCallback, useEffect, useRef, useState } from 'react'

// Autosave for react-hook-form (or anything with a compatible watch/trigger).
//
// Replaces the manual Save button: watches the form, and when a tracked top-level
// field changes vs. the last saved snapshot it debounces, validates ONLY the changed
// fields, and persists the valid ones via `save(patch)`. Writes are serialized
// (latest-wins, never out of order); a failed save is retained and retryable so a
// user's input is never silently dropped.
//
// Params:
//   watch       - RHF `watch` (called with a callback → returns { unsubscribe })
//   trigger     - RHF `trigger(name)` → Promise<boolean> (field validation)
//   save        - async (patch) => void   (throws on failure)
//   fields      - top-level field names to autosave (others ignored)
//   enabled     - when false, no autosave (e.g. read-only / sent invoice)
//   debounceMs  - debounce for staged changes (default 700)
//   initial     - snapshot of already-persisted values (so seeding doesn't re-save)
//
// Returns { status: 'idle'|'saving'|'saved'|'error', retry }.
export function useAutosave({ watch, trigger, save, fields = [], enabled = true, debounceMs = 700, initial = {} }) {
  const [status, setStatus] = useState('idle')

  const saved = useRef({ ...initial }) // last successfully persisted values
  const pending = useRef(null) // staged patch awaiting flush
  const inFlight = useRef(false)
  const errored = useRef(false) // hold auto-continuation until retry() after a failure
  const debounceTimer = useRef(null)
  const idleTimer = useRef(null)

  const saveRef = useRef(save)
  const triggerRef = useRef(trigger)
  saveRef.current = save
  triggerRef.current = trigger

  const scheduleIdle = useCallback(() => {
    clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => setStatus('idle'), 1500)
  }, [])

  const flush = useCallback(async () => {
    if (inFlight.current) return
    const staged = pending.current
    if (!staged || Object.keys(staged).length === 0) return

    // Validate each staged field; persist only the valid ones (don't write garbage).
    const patch = {}
    for (const key of Object.keys(staged)) {
      const ok = await triggerRef.current(key)
      if (ok) patch[key] = staged[key]
    }
    pending.current = null
    if (Object.keys(patch).length === 0) {
      setStatus('idle')
      return
    }

    inFlight.current = true
    setStatus('saving')
    try {
      await saveRef.current(patch)
      saved.current = { ...saved.current, ...patch }
      errored.current = false
      setStatus('saved')
      scheduleIdle()
    } catch {
      // Retain the failed patch (newer staged changes win on top) for retry.
      pending.current = { ...patch, ...(pending.current || {}) }
      errored.current = true
      setStatus('error')
    } finally {
      inFlight.current = false
      // If more changes landed while saving (and we're not in an error hold), keep going.
      if (pending.current && Object.keys(pending.current).length && !errored.current) {
        clearTimeout(debounceTimer.current)
        debounceTimer.current = setTimeout(flush, 0)
      }
    }
  }, [scheduleIdle])

  const stage = useCallback(
    (key, value) => {
      // Skip no-op changes (value already equals last saved and nothing pending for it).
      const same = JSON.stringify(value) === JSON.stringify(saved.current[key])
      if (same && !(pending.current && key in pending.current)) return
      pending.current = { ...(pending.current || {}), [key]: value }
      clearTimeout(debounceTimer.current)
      debounceTimer.current = setTimeout(flush, debounceMs)
    },
    [flush, debounceMs]
  )

  const retry = useCallback(() => {
    errored.current = false
    clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(flush, 0)
  }, [flush])

  useEffect(() => {
    if (!enabled) return undefined
    const sub = watch((values, { name } = {}) => {
      if (!name) return
      const top = name.split('.')[0]
      if (!fields.includes(top)) return
      stage(top, values[top])
    })
    return () => {
      sub?.unsubscribe?.()
      clearTimeout(debounceTimer.current)
      clearTimeout(idleTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, watch, stage, fields.join(',')])

  return { status, retry }
}
