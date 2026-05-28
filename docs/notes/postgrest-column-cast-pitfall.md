# PostgREST 在欄位名上做 cast 的踩坑

最後更新：2026-05-29
受影響範圍：所有用 supabase-js 對 PostgREST 表發 query 的 router

## TL;DR

**不要寫 `supabase.from('t').filter('col::text', 'ilike', '%x%')` 這種「在欄位名上做型態轉型」的 filter。**

它在資料庫端 SQL 跑得起來，但經 supabase-js → PostgREST 的 URL 編碼會被 PostgREST 解釋為「未知 query param」而**靜默忽略整個 predicate**。沒錯誤、沒警告，只是過濾根本沒生效，列表回了一堆「應該被篩掉的」資料。

如果需要對 `text[]` / `jsonb` 等非純文字欄位做子字串搜尋，正確做法是：
1. **首選**：在表上維護一個鏡像 `text` 欄位（trigger 或 generated column）。
2. **次選**：寫 RPC（`create function`）封裝整段 query。
3. 不得已要在 inline filter 用 cast 時，**只走 `.or('col::text.ilike.%x%')`**——`.or()` 內 cast 的解析路徑跟 `.filter()` 不同，PostgREST 認得。

---

## 症狀

`/connections` 頁面的「地點搜尋」輸入「大阪」，結果跟不輸入時一樣——明明資料庫裡有 12 筆 `locations` 含「大阪」。

`q` 全站搜尋的情況比較隱蔽：因為「日本」常出現在 `title`，搜「日本」會命中；但搜「東京」「大阪」這種多半只在 `description` 或 `locations` 的字，會空。從 PM 視角會覺得「搜尋忽好忽壞」，工程師驗 SQL 又跑得起來。

## 原本是怎麼寫的（壞掉版本）

`server/routers/connection.ts`：

```ts
if (input.location_query) {
  query = query.filter('locations::text', 'ilike', `%${input.location_query}%`)
  countQuery = countQuery.filter('locations::text', 'ilike', `%${input.location_query}%`)
}
```

`connections.locations` 是 `text[]`，PostgreSQL 沒有「陣列裡有任何元素包含子字串」的原生 operator，只有：

- `@>`（contains）—— 要 *完整等於* 某個元素，搜「阪」不會命中只含「大阪」的陣列
- `&&`（overlap）—— 陣列對陣列的交集

當時的做法是 `locations::text` 把 `text[]` 強制轉成 `text`（會輸出 PG 陣列字面值 `{東京,大阪}`），然後對這個字串 `ILIKE '%大阪%'`。**SQL 端直接跑這條 query 確實會命中**——我用 MCP 跑 `select count(*) from connections where locations::text ilike '%大阪%'` 拿到 12 筆。看起來邏輯沒問題。

## 為什麼經 PostgREST 就壞了

supabase-js 不直接送 SQL，**送的是 PostgREST 的 URL query string**。`.filter('col', 'op', 'val')` 會組成：

```
GET /connections?col=op.val
```

例如 `.filter('title', 'ilike', '%日本%')` →

```
?title=ilike.%E6%97%A5%E6%9C%AC
```

但這次欄位名是 `locations::text`，含 `:` 字元。URL key 不能直接放 `:`，supabase-js 跑去 `encodeURIComponent`：

```
?locations%3A%3Atext=ilike.%E5%A4%A7%E9%98%AA
```

PostgREST 在解析 URL 時嘗試把 key 對回欄位 + cast，但這條 path 在現行 supabase-js + PostgREST 組合下**沒按預期被辨識**——PostgREST 對未知 query param 的預設行為是 **靜默 ignore**（為了向前相容外掛 param），不會回 400、不會 log。

結果：query 照樣發給 PG、回了正確 schema 的結果集、唯獨那條 `WHERE` 完全沒進去。同時若有別的有效 filter（例如 `status=active`），客戶端會看到「一大堆 active 但跟『大阪』無關的 connection」，**和『搜尋壞了』長得一模一樣，但沒有任何錯誤訊息**。

## 為什麼當初會這樣設計

兩個原因疊加：

1. **直覺合理**。`column::text ILIKE pattern` 在 SQL 是合法寫法，dev 用 psql / Supabase Studio 跑都會 work。寫程式時 mental model 是「supabase-js 是 SQL 的薄包裝」，沒意識到中間隔了 URL serialization 這層。
2. **替代方案有摩擦**。要走 RPC 就要寫 migration、命名、權限、tRPC 型別都要重來；要加 generated column 又會撞 `array_to_string` 不夠 IMMUTABLE 的限制（見下節）。`.filter('col::text', ...)` 一行解決、感覺很乾淨，於是就過了 review。

bug 沒在開發階段抓到、是因為 dev seed 通常「日本」「東京」這種詞會放進 title，搜得到、被當成正常。真正會炸的字（地點 only）在 locations 裡，但開發者不一定會去輸入。

## 修法（採用的方案）

在 `connections` 加一個 trigger 維護的鏡像欄位：

```sql
-- migrations/00042_connections_locations_text.sql
ALTER TABLE public.connections
  ADD COLUMN IF NOT EXISTS locations_text text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.sync_connections_locations_text()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.locations_text := COALESCE(array_to_string(NEW.locations, ' '), '');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS connections_sync_locations_text ON public.connections;
CREATE TRIGGER connections_sync_locations_text
  BEFORE INSERT OR UPDATE OF locations ON public.connections
  FOR EACH ROW EXECUTE FUNCTION public.sync_connections_locations_text();

-- Backfill
UPDATE public.connections
SET locations_text = COALESCE(array_to_string(locations, ' '), '')
WHERE locations_text IS DISTINCT FROM COALESCE(array_to_string(locations, ' '), '');
```

router 改成普通 `.ilike()`，沒有任何 cast、URL 完全標準：

```ts
if (input.location_query) {
  query = query.ilike('locations_text', `%${input.location_query}%`)
  countQuery = countQuery.ilike('locations_text', `%${input.location_query}%`)
}
```

q 全站搜尋的 `locations::text` 也同步換成 `locations_text`。

## 為什麼不是 generated column

最初寫的是：

```sql
ALTER TABLE public.connections
  ADD COLUMN locations_text text
  GENERATED ALWAYS AS (COALESCE(array_to_string(locations, ' '), '')) STORED;
```

PG 回：

```
ERROR: 42P17: generation expression is not immutable
```

PG 對 generated column 要求表達式裡的所有函式 `provolatile = 'i'`（immutable）。`array_to_string(anyarray, text)` 的 volatility 不夠強（涉及 collation 等），所以拒絕。包一層自訂 `IMMUTABLE` wrapper 函式可繞，但 trigger 寫起來一樣短、後續維護更直觀，就直接走 trigger。

## 為什麼不用 RPC

可以做、但要：
- 新 SQL function
- tRPC 端重組查詢（分頁、count、join 都要在 RPC 裡複製）
- 權限要重新審視（`SECURITY DEFINER` 還是 `INVOKER`？RLS 怎麼走？）

成本不划算。`locations_text` 是 ~50 字元、寫入頻率低，加一欄沒有實質代價。

## 為什麼 `.or('col::text.ilike.…')` 反而 OK

PostgREST URL 對 `.or()` 的處理路徑不同：

```
?or=(col::text.ilike.%E5%A4%A7%E9%98%AA)
```

`col::text` 在這裡是 **value 的一部分**（在 `or=(...)` 的括號裡），不是 URL key，PostgREST 解析器走 logical-tree parser，cast 正常被認得。

但在這個 codebase 我們已經改成 `locations_text` 普通欄位，無 cast、無歧義，連 `.or()` 的版本都不需要——避免規則例外更好。

## 怎麼避免再犯

- **規則**：任何 `supabase.from(...).filter(...)`、`.ilike(...)`、`.like(...)` 的第一個參數（欄位名）**不准含 `::`**。
- **掃描**：

```bash
grep -rnE "\.(filter|ilike|like)\(['\"\`][^'\"\`]*::[a-z]" \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=.next \
  Kozukase/
```

  CI 可以加一條：上面 grep 有命中就 fail。
- **想對 `text[]` / `jsonb` 做模糊搜尋時**：加 mirror column（trigger 維護）或 RPC。不要 inline cast。

## 相關檔案

- `supabase/migrations/00042_connections_locations_text.sql` —— 新增 mirror column + trigger
- `server/routers/connection.ts` —— `browse` procedure 內兩處改用 `locations_text`
- `app/(buyer)/connections/page.tsx` —— 地點搜尋改成按 Enter 才提交（順手修的 UX）

## 全 codebase 掃描結果（2026-05-29）

跑下列 grep 確認沒有其他地方踩同樣坑：

```bash
grep -rnE "\.(filter|ilike|like)\(['\"\`][^'\"\`]*::[a-z]" \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=.next \
  Kozukase/
```

回 0 命中。`connection.browse` 是當時唯一中招的 router。
