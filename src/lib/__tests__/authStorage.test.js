import { describe, it, expect, beforeEach } from 'vitest'
import { rememberMeStorage, getRememberMe, setRememberMe, REMEMBER_KEY, setRememberedEmail, getRememberedEmail, EMAIL_KEY } from '@/lib/authStorage'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('getRememberMe / setRememberMe', () => {
  it('defaults to true when unset (preserves persistent sessions + splash handoff)', () => {
    expect(getRememberMe()).toBe(true)
  })
  it('round-trips false', () => {
    setRememberMe(false)
    expect(getRememberMe()).toBe(false)
    expect(localStorage.getItem(REMEMBER_KEY)).toBe('false')
  })
  it('round-trips true', () => {
    setRememberMe(false)
    setRememberMe(true)
    expect(getRememberMe()).toBe(true)
  })
})

describe('rememberMeStorage routing', () => {
  it('writes to localStorage when remembered', () => {
    setRememberMe(true)
    rememberMeStorage.setItem('sb-token', 'abc')
    expect(localStorage.getItem('sb-token')).toBe('abc')
    expect(sessionStorage.getItem('sb-token')).toBeNull()
    expect(rememberMeStorage.getItem('sb-token')).toBe('abc')
  })

  it('writes to sessionStorage when not remembered (and clears the other)', () => {
    setRememberMe(false)
    rememberMeStorage.setItem('sb-token', 'xyz')
    expect(sessionStorage.getItem('sb-token')).toBe('xyz')
    expect(localStorage.getItem('sb-token')).toBeNull()
    expect(rememberMeStorage.getItem('sb-token')).toBe('xyz')
  })

  it('setItem removes a stale duplicate from the non-preferred storage', () => {
    setRememberMe(true)
    rememberMeStorage.setItem('sb-token', 'first') // → localStorage
    setRememberMe(false)
    rememberMeStorage.setItem('sb-token', 'second') // → sessionStorage, clears localStorage
    expect(localStorage.getItem('sb-token')).toBeNull()
    expect(sessionStorage.getItem('sb-token')).toBe('second')
  })

  it('getItem falls back to the other storage (e.g. pre-existing localStorage session)', () => {
    // A session already lives in localStorage but the flag now says session-only.
    localStorage.setItem('sb-token', 'legacy')
    setRememberMe(false)
    expect(rememberMeStorage.getItem('sb-token')).toBe('legacy')
  })

  it('returns null for a missing key', () => {
    expect(rememberMeStorage.getItem('nope')).toBeNull()
  })

  it('removeItem clears both storages', () => {
    localStorage.setItem('sb-token', 'a')
    sessionStorage.setItem('sb-token', 'b')
    rememberMeStorage.removeItem('sb-token')
    expect(localStorage.getItem('sb-token')).toBeNull()
    expect(sessionStorage.getItem('sb-token')).toBeNull()
  })
})

describe('rememberedEmail (combined "Remember me" prefill)', () => {
  it('stores and reads back the email', () => {
    setRememberedEmail('a@b.com')
    expect(getRememberedEmail()).toBe('a@b.com')
  })

  it('clears the email when passed a falsy value (box unchecked)', () => {
    setRememberedEmail('a@b.com')
    setRememberedEmail(null)
    expect(getRememberedEmail()).toBe('')
    expect(localStorage.getItem(EMAIL_KEY)).toBeNull()
  })

  it('returns empty string when nothing is stored', () => {
    expect(getRememberedEmail()).toBe('')
  })
})
