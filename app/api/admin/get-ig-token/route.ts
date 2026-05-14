import { NextRequest, NextResponse } from 'next/server'

// ⚠️ 這是一次性工具 route，取完 token 後請刪除這個檔案

const CLIENT_ID = process.env.INSTAGRAM_CLIENT_ID!
const CLIENT_SECRET = process.env.INSTAGRAM_CLIENT_SECRET!
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/admin/get-ig-token`

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')

  // Step 1: 沒有 code，跳轉去 IG 授權
  if (!code) {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: 'instagram_basic,instagram_manage_messages',
      response_type: 'code',
    })
    return NextResponse.redirect(`https://www.instagram.com/oauth/authorize?${params}`)
  }

  // Step 2: 用 code 換 short-lived token
  const tokenResp = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
      code,
    }),
  })

  if (!tokenResp.ok) {
    return new NextResponse(`短期 token 取得失敗: ${await tokenResp.text()}`, { status: 500 })
  }

  const { access_token: shortToken } = await tokenResp.json()

  // Step 3: 換 long-lived token（60 天）
  const longResp = await fetch(
    `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${CLIENT_SECRET}&access_token=${shortToken}`
  )

  if (!longResp.ok) {
    return new NextResponse(`長期 token 取得失敗: ${await longResp.text()}`, { status: 500 })
  }

  const { access_token: longToken } = await longResp.json()

  // Step 4: 取得帳號 ID
  const meResp = await fetch(`https://graph.instagram.com/me?fields=id,username&access_token=${longToken}`)
  const me = await meResp.json()

  return new NextResponse(
    `<html><body style="font-family:monospace;padding:24px">
      <h2>✅ 取得成功，複製以下兩個值填入 .env.local，然後刪除這個 route</h2>
      <p><strong>INSTAGRAM_ADMIN_TOKEN=</strong><br/>${longToken}</p>
      <p><strong>INSTAGRAM_ADMIN_ACCOUNT_ID=</strong><br/>${me.id}</p>
      <p><strong>NEXT_PUBLIC_INSTAGRAM_ADMIN_HANDLE=</strong><br/>${me.username}</p>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  )
}
