export function parseSafeHttpUrl(value: string): URL | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  // Block control characters and credential-bearing URLs before rendering or storing.
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) return null

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    if (!parsed.hostname) return null
    if (parsed.username || parsed.password) return null
    return parsed
  } catch {
    return null
  }
}

export function getSafeExternalHref(value?: string | null): string | null {
  if (!value) return null
  return parseSafeHttpUrl(value)?.toString() ?? null
}