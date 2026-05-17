// Unique, identifiable names so cleanup + teardown can find test data.
export const E2E_PREFIX = '[E2E]'

export function e2eName(label: string): string {
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  return `${E2E_PREFIX} ${label} ${stamp}`
}
