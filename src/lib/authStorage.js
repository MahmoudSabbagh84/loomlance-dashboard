// Switchable auth storage for "Remember me".
//
// supabase-js v2 chooses its session storage at client-creation time, not per
// sign-in. So we hand it a single adapter that, on every read/write, routes to
// localStorage (persist across browser restarts) or sessionStorage (clears when
// the tab closes) based on a flag the login form sets just before signing in.
//
// The flag itself always lives in localStorage so the choice survives restarts.
// It defaults to "remembered" when absent, preserving the prior persistent
// behavior and the splash → dashboard session handoff (detectSessionInUrl).

export const REMEMBER_KEY = 'loomlance.rememberMe'

export function setRememberMe(remember) {
  try {
    window.localStorage.setItem(REMEMBER_KEY, remember ? 'true' : 'false')
  } catch {
    /* storage unavailable (private mode / SSR) — ignore */
  }
}

export function getRememberMe() {
  try {
    // Default true: only an explicit 'false' opts into session-only storage.
    return window.localStorage.getItem(REMEMBER_KEY) !== 'false'
  } catch {
    return true
  }
}

function preferred() {
  return getRememberMe() ? window.localStorage : window.sessionStorage
}
function other() {
  return getRememberMe() ? window.sessionStorage : window.localStorage
}

export const rememberMeStorage = {
  getItem(key) {
    try {
      const v = preferred().getItem(key)
      if (v !== null) return v
      // Fall back to the other storage so a session written under the previous
      // flag (or a legacy localStorage session) is still found.
      return other().getItem(key)
    } catch {
      return null
    }
  },
  setItem(key, value) {
    try {
      preferred().setItem(key, value)
      other().removeItem(key) // never leave a stale duplicate behind
    } catch {
      /* ignore */
    }
  },
  removeItem(key) {
    try {
      window.localStorage.removeItem(key)
      window.sessionStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  },
}
