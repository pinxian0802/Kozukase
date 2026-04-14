import { toHiragana } from 'wanakana'

/**
 * Normalize search text for consistent matching:
 * - English: lowercase
 * - Japanese: katakana → hiragana
 * - Trim whitespace
 */
export function normalizeSearchText(text: string): string {
  return toHiragana(text.toLowerCase().trim(), { passRomaji: true })
}

/**
 * Check if query meets minimum length for search trigger:
 * - Chinese/Korean: ≥ 1 character
 * - English/numbers only: ≥ 2 characters
 */
export function shouldTriggerSearch(query: string): boolean {
  const trimmed = query.trim()
  if (!trimmed) return false

  // Check for CJK characters (Chinese, Japanese, Korean)
  const cjkRegex = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/
  if (cjkRegex.test(trimmed)) return trimmed.length >= 1

  // English/numbers only - need at least 2 characters
  return trimmed.length >= 2
}
