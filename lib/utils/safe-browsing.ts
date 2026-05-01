const THREAT_LABELS: Record<string, string> = {
  MALWARE: '惡意軟體',
  SOCIAL_ENGINEERING: '釣魚網站',
  UNWANTED_SOFTWARE: '有害軟體',
  POTENTIALLY_HARMFUL_APPLICATION: '潛在有害應用程式',
}

export async function checkUrlSafety(url: string): Promise<{ safe: boolean; threat?: string }> {
  const apiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY
  if (!apiKey) return { safe: true }

  try {
    const res = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: { clientId: 'kozukase', clientVersion: '1.0' },
          threatInfo: {
            threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
            platformTypes: ['ANY_PLATFORM'],
            threatEntryTypes: ['URL'],
            threatEntries: [{ url }],
          },
        }),
        signal: AbortSignal.timeout(3000),
      }
    )

    if (!res.ok) return { safe: true } // API 失敗時 fail-open

    const data = await res.json()
    if (data.matches?.length > 0) {
      const threatType: string = data.matches[0].threatType
      return { safe: false, threat: THREAT_LABELS[threatType] ?? threatType }
    }

    return { safe: true }
  } catch {
    return { safe: true } // 逾時或網路錯誤時 fail-open
  }
}
