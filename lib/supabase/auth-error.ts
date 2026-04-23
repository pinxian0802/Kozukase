type AuthErrorLike = {
  code?: string | null
  message?: string | null
  status?: number
} | null | undefined

const CALLBACK_ERROR_MESSAGES: Record<string, string> = {
  auth_failed: '登入流程失敗，請重新嘗試',
  access_denied: '授權失敗，請重新嘗試',
  server_error: '登入服務暫時異常，請稍後再試',
}

export function getSafeNextPath(nextPath: string | null | undefined) {
  if (!nextPath || !nextPath.startsWith('/') || nextPath.startsWith('//')) {
    return '/'
  }

  const blockedPrefixes = ['/onboarding', '/login', '/register', '/callback', '/forgot-password', '/reset-password']
  if (blockedPrefixes.some((prefix) => nextPath === prefix || nextPath.startsWith(`${prefix}/`) || nextPath.startsWith(`${prefix}?`))) {
    return '/'
  }

  return nextPath
}

export function buildAuthCallbackUrl(origin: string, nextPath: string | null | undefined) {
  const safeNext = getSafeNextPath(nextPath)
  return `${origin}/callback?next=${encodeURIComponent(safeNext)}`
}

export function getAuthCallbackErrorMessage(error: string | null, description?: string | null) {
  if (!error) return null
  const normalized = error.toLowerCase()

  if (CALLBACK_ERROR_MESSAGES[normalized]) {
    return CALLBACK_ERROR_MESSAGES[normalized]
  }

  if (description?.trim()) {
    return description
  }

  return '登入流程失敗，請稍後再試'
}

export function getAuthErrorMessage(
  error: AuthErrorLike,
  fallback = '操作失敗，請稍後再試'
) {
  if (!error) return fallback

  const normalized = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase()

  if (normalized.includes('invalid login credentials')) {
    return 'Email 或密碼錯誤'
  }

  if (normalized.includes('email not confirmed')) {
    return '請先完成 Email 驗證，再進行登入'
  }

  if (normalized.includes('user already registered')) {
    return '此 Email 已註冊，請直接登入'
  }

  if (normalized.includes('user not found')) {
    return '找不到此 Email 帳號'
  }

  if (normalized.includes('signup is disabled')) {
    return '目前暫停註冊，請稍後再試'
  }

  if (normalized.includes('password should be at least')) {
    return '密碼長度不足，請至少使用 6 個字元'
  }

  if (normalized.includes('invalid email')) {
    return 'Email 格式不正確'
  }

  if (
    error.status === 429 ||
    normalized.includes('rate limit') ||
    normalized.includes('security purposes')
  ) {
    return '操作過於頻繁，請稍後再試'
  }

  return fallback
}
