# Product Search Aliases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓商品搜尋支援多語言別名（管理員維護）及 trgm 錯別字容錯，解決「Shiseido 搜不到資生堂」及「隻生堂 搜不到資生堂」的問題。

**Architecture:** 在 `products` 新增 `aliases text[]` 欄位，更新 `search_text` generated column 使其涵蓋別名，並新增 `search_product_ids` RPC 讓買家瀏覽搜尋也改用 pg_trgm。管理員透過商品編輯 Dialog 維護別名。

**Tech Stack:** PostgreSQL pg_trgm、Supabase MCP、tRPC、Next.js、React

---

## Files

| 動作 | 路徑 |
|------|------|
| 新增 | `supabase/migrations/00015_add_product_aliases.sql` |
| 修改 | `server/db/types.ts` |
| 修改 | `server/routers/admin.ts` |
| 修改 | `server/routers/product.ts` |
| 修改 | `components/admin/product-edit-dialog.tsx` |
| 修改 | `app/(admin)/admin/products/page.tsx` |

---

### Task 1: 資料庫 Migration

**Files:**
- Create: `supabase/migrations/00015_add_product_aliases.sql`

- [ ] **Step 1: 寫 migration SQL**

建立 `supabase/migrations/00015_add_product_aliases.sql`，內容如下：

```sql
-- Drop existing generated search_text (cannot alter, must drop and re-add)
ALTER TABLE products DROP COLUMN search_text;

-- Add aliases column
ALTER TABLE products ADD COLUMN aliases text[] NOT NULL DEFAULT '{}';

-- Re-add search_text as generated column, now includes aliases
ALTER TABLE products ADD COLUMN search_text text GENERATED ALWAYS AS (
  lower(name) || ' ' || lower(array_to_string(coalesce(aliases, '{}'::text[]), ' '))
) STORED;

-- Recreate GIN index for trgm
CREATE INDEX idx_products_search_text ON products USING gin(search_text gin_trgm_ops);

-- Add simple RPC: returns product IDs matching a query via trgm (used by buyer browse)
CREATE OR REPLACE FUNCTION search_product_ids(search_query text)
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT p.id
  FROM products p
  LEFT JOIN brands b ON b.id = p.brand_id
  WHERE p.is_removed = false
    AND (
      p.search_text % lower(search_query)
      OR p.search_text ILIKE '%' || lower(search_query) || '%'
      OR COALESCE(b.name, '') ILIKE '%' || search_query || '%'
    );
$$;
```

- [ ] **Step 2: 套用到 Supabase**

用 Supabase MCP 的 `apply_migration` 工具，migration name 填 `add_product_aliases`，SQL 貼上 Step 1 的內容。

套用後驗證：
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'products' AND column_name IN ('aliases', 'search_text');
```
預期：看到 `aliases`（ARRAY）和 `search_text`（text）兩個欄位。

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00015_add_product_aliases.sql
git commit -m "feat: add product aliases column and search_product_ids RPC"
```

---

### Task 2: 更新 TypeScript 型別

**Files:**
- Modify: `server/db/types.ts:88-103`

- [ ] **Step 1: 在 Product type 加 aliases**

在 `server/db/types.ts` 的 `Product` type 中加入 `aliases` 欄位：

```typescript
export type Product = {
  id: string
  name: string
  brand_id: string | null
  brand?: { name: string } | null
  category: ProductCategory | null
  catalog_image_id: string | null
  is_removed: boolean
  removed_at: string | null
  removed_by: string | null
  search_text: string
  aliases: string[]          // ← 新增
  wish_count: number
  created_by: string
  created_at: string
  updated_at: string
}
```

同時更新 `Database` schema 的 `products` Insert 型別（`server/db/types.ts:282-293`），在 `Omit` 裡加 `aliases`，並允許可選傳入：

```typescript
products: TableDefinition<
  Product,
  Omit<Product, 'id' | 'created_at' | 'updated_at' | 'is_removed' | 'wish_count' | 'search_text'> & {
    id?: string
    created_at?: string
    updated_at?: string
    is_removed?: boolean
    wish_count?: number
    search_text?: string
    aliases?: string[]
  },
  Partial<Product>
>
```

- [ ] **Step 2: Commit**

```bash
git add server/db/types.ts
git commit -m "feat: add aliases field to Product type"
```

---

### Task 3: 更新 Admin Router（支援別名 CRUD）

**Files:**
- Modify: `server/routers/admin.ts`

- [ ] **Step 1: updateProduct 加入 aliases**

在 `admin.ts` 的 `updateProduct` mutation 中：

1. 在 input schema 加入 `aliases`：
```typescript
updateProduct: adminProcedure
  .input(z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(200),
    brand_id: z.string().uuid().nullable().optional(),
    model_number: z.string().max(100).nullable().optional(),
    category: productCategoryEnum,
    catalog_image_id: z.string().uuid().nullable().optional(),
    aliases: z.array(z.string().max(200)).max(20).optional(),  // ← 新增
  }))
```

2. 在 update call 加入 `aliases`（在 `ctx.db.from('products').update({...})` 的物件裡）：
```typescript
const { data, error } = await ctx.db
  .from('products')
  .update({
    name: input.name,
    brand_id: input.brand_id ?? null,
    model_number: input.model_number?.trim() ? input.model_number.trim() : null,
    category: input.category,
    catalog_image_id: input.catalog_image_id ?? null,
    aliases: input.aliases ?? [],   // ← 新增
  })
  .eq('id', input.id)
  .select(`
    *,
    product_images:product_images!product_images_product_id_fkey(id, url, r2_key),
    catalog_image:product_images!fk_catalog_image(id, url, r2_key)
  `)
  .single()
```

- [ ] **Step 2: Commit**

```bash
git add server/routers/admin.ts
git commit -m "feat: admin updateProduct supports aliases field"
```

---

### Task 4: 更新 product.browse 改用 trgm

**Files:**
- Modify: `server/routers/product.ts:26-92`

- [ ] **Step 1: 把 ilike 換成 search_product_ids RPC**

在 `product.ts` 的 `browse` query handler 中，找到這段：

```typescript
if (input.query) {
  const normalized = normalizeSearchText(input.query)
  query = query.ilike('search_text', `%${normalized}%`)
}
```

替換成：

```typescript
if (input.query) {
  const normalized = normalizeSearchText(input.query)
  const { data: matchingIds } = await ctx.db.rpc('search_product_ids', {
    search_query: normalized,
  })
  const ids = (matchingIds ?? []).map((r: { id: string }) => r.id)
  if (ids.length === 0) {
    return { items: [], nextCursor: null }
  }
  query = query.in('id', ids)
}
```

- [ ] **Step 2: Commit**

```bash
git add server/routers/product.ts
git commit -m "feat: product.browse uses trgm via search_product_ids RPC"
```

---

### Task 5: 更新 ProductEditDialog UI（別名輸入）

**Files:**
- Modify: `components/admin/product-edit-dialog.tsx`

- [ ] **Step 1: 更新型別定義**

在 `product-edit-dialog.tsx` 更新兩個 export type：

```typescript
export type AdminEditableProduct = {
  id: string
  name: string
  brand_id: string | null
  brand?: { name: string } | null
  model_number: string | null
  category: ProductCategory | null
  catalog_image_id: string | null
  catalog_image?: { url: string | null } | null
  product_images?: AdminProductImage[] | null
  aliases?: string[] | null   // ← 新增
}

export type AdminProductEditValues = {
  id: string
  name: string
  brand_id: string | null
  model_number: string | null
  category: ProductCategory
  catalog_image_id: string | null
  aliases: string[]           // ← 新增
}
```

- [ ] **Step 2: 加入 aliases state 與 UI**

在 `ProductEditDialog` component 中：

1. 在現有 state 宣告後加入：
```typescript
const [aliases, setAliases] = useState<string[]>(() => product?.aliases ?? [])
const [aliasInput, setAliasInput] = useState('')
```

2. 加入 addAlias / removeAlias helpers（放在 `handleSave` 前）：
```typescript
const addAlias = () => {
  const trimmed = aliasInput.trim()
  if (!trimmed || aliases.includes(trimmed)) return
  setAliases([...aliases, trimmed])
  setAliasInput('')
}

const removeAlias = (alias: string) => {
  setAliases(aliases.filter((a) => a !== alias))
}
```

3. 在 `handleSave` 的 `onSave` 呼叫加入 `aliases`：
```typescript
await onSave({
  id: product.id,
  name: trimmedName,
  brand_id: brandId === 'none' ? null : brandId,
  model_number: modelNumber.trim() || null,
  category,
  catalog_image_id: catalogImageId === 'none' ? null : catalogImageId,
  aliases,   // ← 新增
})
```

4. 在 form 的 `<div className="grid gap-4 md:grid-cols-2">` 最後（封面圖片欄位之後）加入別名欄位：
```tsx
<div className="space-y-2 md:col-span-2">
  <Label>搜尋別名</Label>
  <p className="text-xs text-muted-foreground">輸入其他語言的名稱（如英文、日文），讓買家更容易搜尋到此商品</p>
  <div className="flex gap-2">
    <Input
      value={aliasInput}
      onChange={(e) => setAliasInput(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAlias() } }}
      placeholder="輸入別名後按 Enter"
      className="flex-1"
    />
    <Button type="button" variant="outline" onClick={addAlias} disabled={!aliasInput.trim()}>
      新增
    </Button>
  </div>
  {aliases.length > 0 && (
    <div className="flex flex-wrap gap-1 mt-2">
      {aliases.map((alias) => (
        <Badge key={alias} variant="secondary" className="gap-1 pr-1">
          {alias}
          <button
            type="button"
            onClick={() => removeAlias(alias)}
            className="ml-1 rounded-full hover:bg-muted"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
    </div>
  )}
</div>
```

5. 在 file 頂端的 import 確認有 `X` 和 `Badge`：
```typescript
import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
```

- [ ] **Step 3: Commit**

```bash
git add components/admin/product-edit-dialog.tsx
git commit -m "feat: admin product edit dialog supports aliases"
```

---

### Task 6: 串接 Admin Products Page

**Files:**
- Modify: `app/(admin)/admin/products/page.tsx`

- [ ] **Step 1: 把 aliases 傳給 ProductEditDialog**

`admin.listProducts` 的 `*` 已包含 `aliases`，`setEditingProduct(product)` 會帶上它。

但 `handleEditSave` 需要把 `aliases` 傳給 `updateProduct.mutateAsync`。目前 `AdminProductEditValues` 已包含 `aliases`，所以 `handleEditSave` 不需要改動，直接傳 `values` 即可。

確認 `handleEditSave` 長這樣就行（不用改）：
```typescript
const handleEditSave = async (values: AdminProductEditValues) => {
  await updateProduct.mutateAsync(values)
}
```

- [ ] **Step 2: 驗證資料流**

在瀏覽器開 `/admin/products`，點選一個商品的「編輯」按鈕：
- 確認 Dialog 出現「搜尋別名」欄位
- 新增一個別名（如 `Shiseido`），儲存
- 重新開啟同一商品的編輯，確認別名已保留

- [ ] **Step 3: 驗證搜尋效果**

在 `/search` 頁面搜尋剛才設定的別名，確認該商品出現在結果中。

- [ ] **Step 4: Commit**

```bash
git add app/(admin)/admin/products/page.tsx
git commit -m "feat: wire aliases through admin products page"
```
