'use client'

import { useState } from 'react'

export function useShare(title: string, url?: string) {
  const [copied, setCopied] = useState(false)

  const getUrl = () =>
    url ?? (typeof window !== 'undefined' ? window.location.href : '')

  const copyLink = async () => {
    await navigator.clipboard.writeText(getUrl())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareToLine = () => {
    window.open(
      'https://social-plugins.line.me/lineit/share?url=' + encodeURIComponent(getUrl()),
      '_blank'
    )
  }

  const shareToThreads = () => {
    window.open(
      'https://www.threads.net/intent/post?text=' +
        encodeURIComponent(title + ' ' + getUrl()),
      '_blank'
    )
  }

  return { copied, copyLink, shareToLine, shareToThreads }
}
