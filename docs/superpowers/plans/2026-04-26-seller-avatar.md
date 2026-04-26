# Seller Avatar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `sellers` 資料表新增獨立的 `avatar_url` 欄位，並在「成為賣家」頁面加上頭貼上傳（含 rollback），同時補上 onboarding 頁面的 rollback 機制。

**Architecture:** 圖片透過 presigned URL 直傳 Cloudflare R2，前端在表單送出時才上傳（deferred upload）。若上傳成功但後續 mutation 失敗，呼叫 `deleteObjects` 清除已上傳的 R2 檔案（rollback）。Seller avatar 獨立於 `profiles.avatar_url`，存於 `sellers.avatar_url`。

**Tech Stack:** Next.js (App Router), tRPC, Supabase (PostgreSQL), Cloudflare R2, Zod

---

## File Map

| 檔案 | 動作 | 說明 |
|------|------|------|
| `supabase/migrations/00014_add_seller_avatar.sql` | 新增 | sellers 加 avatar_url 欄位 |
| `lib/validators/seller.ts` | 修改 | becomeSellerInput / updateSellerInput 加 avatar_url |
| `server/routers/seller.ts` | 修改 | becomeSeller insert 帶入 avatar_url |
| `app/(user)/become-seller/page.tsx` | 修改 | 加 AvatarUpload + deferred upload + rollback |
| `app/(auth)/onboarding/page.tsx` | 修改 | 補 rollback 機制 |

---

### Task 1: DB Migration — sellers.avatar_url

**Files:**
- Create: `supabase/migrations/00014_add_seller_avatar.sql`

- [ ] **Step 1: 建立 migration 檔**

建立 `supabase/migrations/00014_add_seller_avatar.sql`，內容：

```sql
ALTER TABLE sellers ADD COLUMN avatar_url text;
```

- [ ] **Step 2: 用 Supabase MCP 套用 migration**

呼叫 `mcp__supabase__apply_migration`：
- `name`: `add_seller_avatar`
- `query`: `ALTER TABLE sellers ADD COLUMN avatar_url text;`

確認執行後無錯誤。

- [ ] **Step 3: 驗證欄位存在**

呼叫 `mcp__supabase__execute_sql`：

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'sellers' AND column_name = 'avatar_url';
```

預期回傳一筆：`avatar_url | text | YES`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00014_add_seller_avatar.sql
git commit -m "feat: add avatar_url column to sellers table"
```

---

### Task 2: Validator — 加入 avatar_url

**Files:**
- Modify: `lib/validators/seller.ts`

- [ ] **Step 1: 更新 validator**

將 `lib/validators/seller.ts` 改為：

```ts
import { z } from 'zod'

export const becomeSellerInput = z.object({
  name: z.string().min(1, '賣家名稱為必填').max(50),
  phone_number: z.string().min(8, '請輸入有效的手機號碼').max(20),
  region_ids: z.array(z.string().uuid()).min(1, '請至少選擇一個代購地區'),
  bio: z.string().max(300).optional(),
  avatar_url: z.string().url().optional(),
})

export const updateSellerInput = z.object({
  name: z.string().min(1).max(50).optional(),
  region_ids: z.array(z.string().uuid()).min(1).optional(),
  bio: z.string().max(300).optional(),
  avatar_url: z.string().url().nullable().optional(),
})
```

- [ ] **Step 2: 確認 TypeScript 無錯誤**

```bash
cd Kozukase && npx tsc --noEmit
```

預期：無任何錯誤輸出。

- [ ] **Step 3: Commit**

```bash
git add lib/validators/seller.ts
git commit -m "feat: add avatar_url to seller validators"
```

---

### Task 3: tRPC — becomeSeller 帶入 avatar_url

**Files:**
- Modify: `server/routers/seller.ts:24-29`

- [ ] **Step 1: 更新 becomeSeller insert**

找到 `server/routers/seller.ts` 中的 `becomeSeller` mutation，將 insert 區塊改為：

```ts
const { data: seller, error } = await ctx.db
  .from('sellers')
  .insert({
    id: ctx.user.id,
    name: input.name,
    phone_number: input.phone_number,
    phone_verified: true, // TODO: implement OTP verification
    bio: input.bio ?? null,
    avatar_url: input.avatar_url ?? null,
  })
  .select()
  .single()
```

- [ ] **Step 2: 確認 TypeScript 無錯誤**

```bash
cd Kozukase && npx tsc --noEmit
```

預期：無任何錯誤輸出。

- [ ] **Step 3: Commit**

```bash
git add server/routers/seller.ts
git commit -m "feat: persist avatar_url in becomeSeller mutation"
```

---

### Task 4: become-seller 頁面 — AvatarUpload + rollback

**Files:**
- Modify: `app/(user)/become-seller/page.tsx`

- [ ] **Step 1: 更新 imports**

在檔案頂部加入缺少的 import：

```ts
import { AvatarUpload } from '@/components/shared/avatar-upload'
import { uploadImageFiles } from '@/components/shared/image-upload'
```

- [ ] **Step 2: 加入 avatar 相關 state 與 mutation**

在現有 state 宣告區（`const [bio, setBio]...` 之後）加入：

```ts
const [avatarImage, setAvatarImage] = useState<{ url: string; r2Key: string } | null>(null)
const [pendingFile, setPendingFile] = useState<File | null>(null)

const getPresignedUrl = trpc.upload.getPresignedUrl.useMutation()
const deleteObjects = trpc.upload.deleteObjects.useMutation()
```

- [ ] **Step 3: 改寫 handleSubmit 為 async，加入上傳與 rollback 邏輯**

將現有的 `handleSubmit` 改為：

```ts
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  const nextErrors: { sellerName?: string; phone?: string; regions?: string } = {}

  if (!sellerName.trim()) {
    nextErrors.sellerName = '賣家名稱為必填'
  }

  if (!phone.trim()) {
    nextErrors.phone = '手機號碼為必填'
  }

  if (selectedRegions.length === 0) {
    nextErrors.regions = '請至少選擇一個代購地區'
  }

  if (Object.keys(nextErrors).length > 0) {
    setErrors(nextErrors)
    return
  }

  setErrors({})

  let finalAvatarUrl = avatarImage?.url
  let uploadedR2Key: string | null = null

  try {
    if (pendingFile) {
      const [uploaded] = await uploadImageFiles('avatar', [pendingFile], getPresignedUrl.mutateAsync)
      finalAvatarUrl = uploaded.url
      uploadedR2Key = uploaded.r2Key
    }

    await becomeSeller.mutateAsync({
      name: sellerName.trim(),
      phone_number: phone.trim(),
      region_ids: selectedRegions,
      bio: bio.trim() || undefined,
      avatar_url: finalAvatarUrl,
    })

    toast.success('成功成為賣家！')
    router.push('/dashboard')
  } catch (err: unknown) {
    if (uploadedR2Key) {
      await deleteObjects.mutateAsync({ r2Keys: [uploadedR2Key] }).catch(() => {})
    }
    toast.error(err instanceof Error ? err.message : '操作失敗')
  }
}
```

注意：`becomeSeller` 原本用的是 `.mutate()`（fire-and-forget），這裡改為 `.mutateAsync()` 才能 await 並捕捉錯誤。同時移除原本在 `useMutation` 的 `onSuccess` / `onError` callback，改由 try/catch 統一處理。

將 `becomeSeller` mutation 改為：

```ts
const becomeSeller = trpc.seller.becomeSeller.useMutation()
```

- [ ] **Step 4: 在表單最上方加入 AvatarUpload**

在 `<form>` 內的第一個 `<div>`（賣家名稱欄位）之前插入：

```tsx
<div>
  <Label>頭貼（選填）</Label>
  <AvatarUpload
    value={avatarImage}
    onChange={setAvatarImage}
    pendingFile={pendingFile}
    onPendingFileChange={setPendingFile}
    className="mt-1"
  />
</div>
```

- [ ] **Step 5: 更新 submit button 的 disabled 條件**

原本：

```tsx
<button type="submit" className={buttonVariants({ className: 'w-full' })} disabled={becomeSeller.isPending}>
```

改為（加入 getPresignedUrl.isPending）：

```tsx
<button type="submit" className={buttonVariants({ className: 'w-full' })} disabled={becomeSeller.isPending || getPresignedUrl.isPending}>
```

- [ ] **Step 6: 確認 TypeScript 無錯誤**

```bash
cd Kozukase && npx tsc --noEmit
```

預期：無任何錯誤輸出。

- [ ] **Step 7: Commit**

```bash
git add app/(user)/become-seller/page.tsx
git commit -m "feat: add avatar upload with rollback to become-seller page"
```

---

### Task 5: Onboarding 頁面 — 補 rollback 機制

**Files:**
- Modify: `app/(auth)/onboarding/page.tsx`

- [ ] **Step 1: 加入 deleteObjects mutation**

在現有 mutation 宣告區（`getPresignedUrl` 下方）加入：

```ts
const deleteObjects = trpc.upload.deleteObjects.useMutation()
```

- [ ] **Step 2: 改寫 handleSubmit 的 try/catch，加入 rollback**

找到 `handleSubmit` 中的 try 區塊，將整個 try/catch/finally 改為：

```ts
let uploadedR2Key: string | null = null

try {
  if (isEmailUser) {
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      toast.error(getAuthErrorMessage(error, '密碼設定失敗，請稍後再試'))
      return
    }
  }

  let finalAvatarUrl = avatarImage?.url
  if (pendingFile) {
    const [uploaded] = await uploadImageFiles('avatar', [pendingFile], getPresignedUrl.mutateAsync)
    finalAvatarUrl = uploaded.url
    uploadedR2Key = uploaded.r2Key
  }

  await completeOnboarding.mutateAsync({
    username,
    display_name: displayName.trim(),
    avatar_url: finalAvatarUrl,
  })

  toast.success('歡迎加入！')
  router.push(safeNext)
  router.refresh()
} catch (error: unknown) {
  if (uploadedR2Key) {
    await deleteObjects.mutateAsync({ r2Keys: [uploadedR2Key] }).catch(() => {})
  }
  const message = error instanceof Error ? error.message : ''
  if (message.includes('已被使用')) {
    setErrors(prev => ({ ...prev, username: '此 username 已被使用' }))
  } else if (message.includes('已設定完成')) {
    router.push(safeNext)
    router.refresh()
  } else {
    toast.error('設定失敗，請稍後再試')
  }
} finally {
  setSubmitting(false)
}
```

注意：原本的 `completeOnboarding.mutateAsync()` 已是 async，不需要改。只是新增 `uploadedR2Key` 追蹤與 catch 內的 cleanup。

- [ ] **Step 3: 確認 TypeScript 無錯誤**

```bash
cd Kozukase && npx tsc --noEmit
```

預期：無任何錯誤輸出。

- [ ] **Step 4: Commit**

```bash
git add app/(auth)/onboarding/page.tsx
git commit -m "fix: add R2 rollback on completeOnboarding failure in onboarding page"
```

---

### Task 6: 更新 platform-overview.md

**Files:**
- Modify: `docs/platform-overview.md`

- [ ] **Step 1: 在賣家必填資訊區塊補上 avatar_url**

找到 `docs/platform-overview.md` 中的「選填資訊」區塊，更新為：

```markdown
**選填資訊：**
- 頭貼（`avatar_url`，獨立於個人 profile 頭貼）
- 自我介紹（`bio`）
```

- [ ] **Step 2: Commit**

```bash
git add docs/platform-overview.md
git commit -m "docs: update platform-overview with seller avatar_url field"
```
