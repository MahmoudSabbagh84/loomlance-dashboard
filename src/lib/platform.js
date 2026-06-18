function detectMac() {
  if (typeof navigator === 'undefined') return false
  // Prefer the modern, non-deprecated hint when available.
  const uaData = navigator.userAgentData
  if (uaData && typeof uaData.platform === 'string') {
    return /mac/i.test(uaData.platform)
  }
  const p = navigator.platform || navigator.userAgent || ''
  return /mac|iphone|ipad|ipod/i.test(p)
}

export const isMac = detectMac()

// Display label for the Cmd/Ctrl+K shortcut, matched to the host OS.
export const searchHotkeyLabel = isMac ? '⌘K' : 'Ctrl K'
