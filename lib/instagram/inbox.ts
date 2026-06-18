// 後台批次比對用：抓一輪 IG 收件匣的所有訊息（一次掃描，記憶體內比對多筆待審件）。

export type IgInboxMessage = {
  username: string // 寄件者 IG 帳號（小寫）
  text: string     // 訊息內容（已 trim）
  senderId: string | null // 寄件者 IGSID，比對成功時寫進 sellers.ig_user_id
}

// 回傳收件匣訊息陣列；若未設定串接金鑰則回傳 null（讓呼叫端給出明確錯誤）。
export async function fetchIgInboxMessages(): Promise<IgInboxMessage[] | null> {
  const adminToken = process.env.INSTAGRAM_ADMIN_TOKEN
  const pageId = process.env.INSTAGRAM_PAGE_ID
  if (!adminToken || !pageId) return null

  // Step 1: 取得對話列表
  const convResp = await fetch(
    `https://graph.facebook.com/v22.0/${pageId}/conversations?platform=instagram&access_token=${adminToken}`
  )
  if (!convResp.ok) {
    throw new Error(`IG conversations HTTP ${convResp.status}`)
  }
  const convData = await convResp.json()
  const conversations: { id: string }[] = convData.data ?? []

  // Step 2: 逐一取得每個對話的訊息，攤平成一個陣列
  const messages: IgInboxMessage[] = []
  for (const conv of conversations) {
    const msgResp = await fetch(
      `https://graph.facebook.com/v22.0/${conv.id}/messages?fields=message,from,created_time&access_token=${adminToken}`
    )
    if (!msgResp.ok) continue

    const msgData = await msgResp.json()
    const rows: {
      message?: string
      from?: { username?: string; id?: string }
    }[] = msgData.data ?? []

    for (const row of rows) {
      const username = row.from?.username?.toLowerCase()
      if (!username || row.message == null) continue
      messages.push({
        username,
        text: row.message.trim(),
        senderId: row.from?.id ?? null,
      })
    }
  }

  return messages
}
