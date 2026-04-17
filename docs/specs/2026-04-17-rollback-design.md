# 圖片上傳與建立流程的 Rollback 設計

> 最後更新：2026-04-17

---

## 背景

原本的系統在新增代購、連線公告、商品時，流程是：

```
先上傳圖片到 R2 → 再建立 DB 紀錄 → 最後 confirm 圖片關聯
```

這個順序有幾個問題：
- 圖片上傳成功但 DB 建立失敗 → R2 留下孤兒檔案
- DB 建立成功但 confirm 失敗 → 紀錄存在但沒有圖片
- edit flow 的 `DELETE + INSERT` 不是 atomic → delete 成功、insert 失敗會讓圖片消失

本次改造的目標：**任何一步驟失敗，前面所有已建立的資料都要被回滾，讓整件事彷彿沒有發生過。**

---

## 改造後的架構

### 兩種 Rollback 機制並用

| 類型 | 適用場景 | 機制 |
|------|----------|------|
| **補償式回滾（Compensating Rollback）** | 跨系統（DB + R2）失敗時 | catch 後反向刪除已建立的資源 |
| **資料庫 Transaction（RPC）** | DB 內部的 delete + insert | PostgreSQL function 確保 atomic |

---

## 一、新增代購（listing create）

### 改造前的問題流程
```
1. upload listing images  → R2 有檔案
2. createListing          → DB 有紀錄（status=active，通知立刻送出）
3. confirmListingImages   → 失敗 → 紀錄存在但沒有圖片，且通知已送
```

### 改造後的安全流程

**檔案：** `components/listing/listing-form.tsx`

```
Pre-validate（active 模式才做）
  ↓ 貼文連結/出貨天數/價格都有填才繼續
Step 1: createListing(status='draft')
  → DB 有紀錄（draft，不送通知）
  → 記住 createdListingId
Step 2: uploadImageFiles('listing', pendingFiles)
  → R2 有檔案
  → 記住 uploadedR2Keys[]
Step 3: confirmListingImages（RPC atomic）
  → DB 寫入 listing_images
Step 4: publishListing（只有 status=active 時執行）
  → DB 改狀態為 active
  → 送出通知（在所有圖片都確認後才觸發）

❌ 任何步驟失敗：
  → deleteObjects(uploadedR2Keys)   ← 清 R2 孤兒
  → deleteListing(createdListingId) ← 清 draft
  → toast.error(原始錯誤訊息)
```

### 關鍵改動
- 通知被延後到最後一步（publish）才送出，避免「通知已送但資料被回滾」
- `createListing` 永遠以 `draft` 身份建立，不帶副作用
- `handleSave('active')` 在最後才呼叫 `publishListing`

---

## 二、新增商品目錄圖（product image create）

### 改造前的問題
```
createProduct → uploadImageFiles → confirmProductImage
                                   ↑ 如果失敗：R2 有孤兒圖、product 在 DB 但沒圖
```

### 改造後的流程

**檔案：** `app/(seller)/dashboard/listings/new/page.tsx`

```
createProduct
  → 記住 product.id（寫入 createdProductIdRef.current）
uploadImageFiles('product')
  → 取得 uploaded[0].r2Key
confirmProductImage
  ❌ 如果失敗：
    → deleteObjects([uploaded[0].r2Key]) ← 清 R2 孤兒圖
    → rethrow（讓外層 listing 的 rollback 繼續）
```

> **注意：** product 本身不會在這裡被刪除。它是目錄資料，即使沒有圖片也是有效的商品紀錄，之後可以補圖。外層的 listing rollback 會視情況決定是否刪除 product（目前 listing 失敗不刪 product，因為 product 是可重複使用的目錄）。

---

## 三、新增連線公告（connection create）

### 改造前的問題流程
```
1. uploadImageFiles  → R2 有檔案
2. createConnection  → DB 有紀錄（立刻 active，對用戶可見）
3. confirmImages     → 失敗 → 連線公告存在但沒有圖片
```

### 改造後的安全流程

**檔案：** `components/connection/connection-form.tsx`

```
Step 1: createConnection
  → DB 有紀錄（status=active）
  → 記住 createdConnectionId
Step 2: uploadImageFiles('connection', pendingFiles)
  → R2 有檔案
  → 記住 uploadedR2Keys[]
Step 3: confirmConnectionImages（RPC atomic）
  → DB 寫入 connection_images

❌ 任何步驟失敗：
  → deleteObjects(uploadedR2Keys)          ← 清 R2 孤兒
  → connection.delete(createdConnectionId) ← 刪除 DB 紀錄
  → toast.error(原始錯誤訊息)
```

### 注意：connection create 的短暫可見窗口
Connection 建立即為 active（目前設計沒有 draft 狀態）。這代表：
- Step 1 成功後，連線公告短暫對買家可見（幾百毫秒到幾秒內）
- 如果 Step 2 或 3 失敗，rollback 刪除後，公告消失
- 這個窗口非常短，實際上對使用者體驗影響極低

---

## 四、編輯流程（listing edit / connection edit）

### 問題：delete-then-insert 不是 atomic

改造前，`confirmListingImages` 和 `confirmConnectionImages` 是：
```ts
DELETE FROM listing_images WHERE listing_id = X    // 成功
INSERT INTO listing_images VALUES (...)             // 若失敗 → 圖片全消失！
```

### 改造後：PostgreSQL RPC Function（Atomic）

**新 migration：** `supabase/migrations/00005_replace_images_rpc.sql`

```sql
CREATE OR REPLACE FUNCTION replace_listing_images(p_listing_id uuid, p_images jsonb)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM listing_images WHERE listing_id = p_listing_id;
  IF jsonb_array_length(p_images) > 0 THEN
    INSERT INTO listing_images (listing_id, r2_key, url, sort_order)
    SELECT p_listing_id, elem->>'r2_key', elem->>'url', (elem->>'sort_order')::smallint
    FROM jsonb_array_elements(p_images) AS elem;
  END IF;
END; $$;
```

這個 function 在 PostgreSQL 內以單一 transaction 執行：
- DELETE 成功但 INSERT 失敗 → 整個 function 回滾，舊圖片保留
- 只有 DELETE + INSERT 都成功才算完成

**如何套用 migration（⚠️ 必須手動執行）：**
1. 開啟 Supabase Dashboard → SQL Editor
2. 貼入 `supabase/migrations/00005_replace_images_rpc.sql` 的全部內容執行

---

## 五、新增的 API 說明

### `upload.deleteObjects`

**用途：** Compensating rollback 時刪除 R2 上已上傳的檔案

**安全性：** Server 端會驗證所有 r2Key 的路徑前綴必須符合 `{purpose}/{userId}/`，確保只能刪除屬於自己的檔案

```ts
trpc.upload.deleteObjects.mutateAsync({ r2Keys: ['listing/user-id/file.webp', ...] })
```

### `connection.delete`

**用途：** Compensating rollback 時刪除剛建立的 connection DB 紀錄

**安全性：** 只允許賣家刪除屬於自己的 connection

```ts
trpc.connection.delete.useMutation()
```

---

## 六、各種失敗情境的處理結果

| 失敗點 | 哪些資料存在 | Rollback 動作 | 使用者看到 |
|--------|-------------|---------------|---------|
| createListing 失敗 | 無 | 無需 rollback | 錯誤訊息，可重試 |
| uploadListingImages 失敗 | draft listing 在 DB | delete listing | 錯誤訊息，可重試（不重複建立 listing） |
| confirmListingImages 失敗 | draft listing + R2 圖片 | delete R2 keys + delete listing | 錯誤訊息，可重試 |
| publishListing 失敗 | draft listing（有圖片） | delete R2 keys + delete listing | 錯誤訊息，通常是欄位未填 |
| createConnection 失敗 | 無 | 無需 rollback | 錯誤訊息，可重試 |
| uploadConnectionImages 失敗 | connection 在 DB（active） | delete connection | 錯誤訊息，可重試 |
| confirmConnectionImages 失敗 | connection + R2 圖片 | delete R2 keys + delete connection | 錯誤訊息，可重試 |
| confirmProductImage 失敗 | product 在 DB + R2 孤兒圖 | delete R2 孤兒圖（product 保留） | 錯誤訊息，商品建立成功但無圖（可補圖） |
| listing edit confirImages（RPC 失敗）| listing 不變 | DB 自動 rollback，舊圖保留 | 錯誤訊息，資料未損毀 |

---

## 七、殘留風險（理論上存在但實際影響極低）

即使做了以上改造，仍有以下情況無法 100% 消除：

| 情況 | 為什麼無法 100% 消除 | 嚴重性 |
|------|---------------------|--------|
| Server process 在上傳成功後、rollback 執行前 crash | 分散式系統無法跨 process 保證 | 低（極少發生，cleanup cron 可作保險） |
| deleteObjects 本身失敗（R2 暫時不可用） | 兩個分散式系統，補償操作也可能失敗 | 低（孤兒檔案不影響功能） |
| connection 建立後、rollback 刪除前的短暫可見窗口 | connection 無 draft 狀態，建立即 active | 低（窗口不超過幾秒） |

**終極保險**：未來可加一個 cron job，掃描 R2 上存在但 DB 裡沒有對應 r2_key 的物件並刪除。

---

## 八、修改的檔案清單

| 檔案 | 修改說明 |
|------|---------|
| `supabase/migrations/00005_replace_images_rpc.sql` | 新增：atomic image replace RPC functions（**需手動套用**） |
| `server/routers/upload.ts` | 新增 `deleteObjects` mutation；`confirmListingImages` 和 `confirmConnectionImages` 改用 RPC |
| `server/routers/connection.ts` | 新增 `delete` mutation |
| `components/listing/listing-form.tsx` | create flow 改為先建 DB draft，加 pre-validate，加 rollback；publish 延後到最後 |
| `components/connection/connection-form.tsx` | create flow 改為先建 DB，加 rollback |
| `app/(seller)/dashboard/listings/new/page.tsx` | `createProductForListing` 加 R2 cleanup on confirmProductImage 失敗 |



那如果我改一下順序 先在 Supabase DB 建立記錄 然後再上傳圖片到R2 然後再把第 1 步得到的 r2Key + url 跟第 2 步得到的紀錄 id 關聯起來，寫入 DB 圖片關聯表 然後第一步失敗的話 就沒事 如果第二部失敗 就把第一步刪掉 如果三部失敗 就把一跟二都刪掉 我一跟二新增的時候 應該都會有紀錄吧 我可以根據這些紀錄來把我的資料刪掉吧

可以，而且這個順序比你現在的 create flow 更合理。
你的想法本質上就是：

先在 Supabase 建主紀錄
再上傳圖片到 R2
最後把圖片資訊寫回 DB 關聯表
任何一步失敗，就把前面成功的東西補償刪掉
這是對的。這種做法在實務上叫做補償式回滾。對你現在這個系統來說，這會比目前流程安全很多。

先直接回答你的核心問題

你這樣改順序，可不可以？
可以。

如果第 1 步失敗，是不是就沒事？
是。因為主紀錄根本沒建起來，後面也不該繼續做。

如果第 2 步失敗，可不可以把第 1 步刪掉？
可以，而且應該這樣做。

如果第 3 步失敗，可不可以把第 1 步跟第 2 步都刪掉？
可以，而且應該這樣做。

但有一個很重要的細節
你問：

我一跟二新增的時候，應該都會有紀錄吧，我可以根據這些紀錄來把資料刪掉吧

答案是：

第 1 步一定有 DB 紀錄
這個沒問題。
例如：

product.id
listing.id
connection.id
你之後要 rollback，直接用這個 id 去刪 DB 就可以。

第 2 步不一定有 DB 紀錄
這要分開看。

你現在的 app/api/upload/route.ts 上傳成功後，只會回傳：

r2Key
publicUrl
也就是說：

R2 有物件
但 DB 目前沒有一筆「這次上傳成功」的正式紀錄
所以第 2 步要 rollback 時，不是靠 DB 查，而是靠：

你手上暫時記住的 r2Key
然後呼叫 R2 delete API 去刪掉那個 object
換句話說：

第 1 步 rollback 靠 DB id
第 2 步 rollback 靠 r2Key
不是兩步都天然有 DB 紀錄。

你這個流程怎麼設計才是正確的
我建議把 create flow 改成這樣：

建議流程
建立主紀錄，先存成可回滾狀態
上傳圖片到 R2，收集成功的 r2Key
寫入圖片關聯表
全部成功後再正式完成流程
如果任何一步失敗：

刪 R2 上傳成功的檔案
刪第 1 步建立的主紀錄
如果有其他副作用，也一起回滾
用 listing 當例子，完整展開一次
假設是新增代購。

你想改成的順序
create listing
upload listing images
confirm listing images
這個順序比現在好，因為：

create listing 失敗：什麼都沒發生
upload images 失敗：只要 delete listing
confirm images 失敗：delete listing + delete uploaded R2 objects
這樣比現在先上傳圖片安全很多。

但這裡有一個你一定要注意的地方
在 server/routers/listing.ts 裡，現在 listing.create 不是純粹只建資料而已。
它在狀態是 active 時，還會送通知。

這代表如果你改成：

create listing
upload images
confirm images
第 3 步失敗
delete listing rollback
那會出現一個新問題：

listing 已經建立時，通知可能已經送出去了
後面 rollback 把 listing 刪掉了
但通知不會自動消失
所以如果你要做這種全回滾設計，第 1 步不能有太早發生的副作用。

所以真正推薦的版本是這個
最佳化後的 create 流程
建立主紀錄，但先不要觸發對外副作用
上傳圖片到 R2
在 DB 裡 transaction 寫入圖片關聯
最後再把狀態切成正式完成，或最後再送通知
換成 listing：

create listing as draft or pending_internal
upload images to R2
confirm listing images in DB transaction
finalize listing status to active
send notifications
這樣如果第 2 或第 3 步失敗，你就刪 draft listing 即可，外界完全不知道它存在過。

所以你的想法是對的，但我建議再補一層
你的版本：

建 DB
上傳圖
confirm
我會再補成：

建 DB，但先是可回滾狀態
上傳圖
confirm 圖片
finalize 主紀錄
最後才做通知等副作用
這樣會更乾淨。

你現在最想知道的：到底能不能靠紀錄刪掉
可以，但要分兩類紀錄。

類型 A：DB 主紀錄
例如：

product.id
listing.id
connection.id
這些都可以直接 rollback。

類型 B：R2 上傳結果
目前不是 DB 紀錄，而是執行結果：

r2Key
url
你可以用這些來刪 R2 檔案。
所以 technically 也能 rollback，只是不是靠查 DB，而是靠程式在流程裡保存這些成功結果。

我會怎麼設計 rollback 資料結構
如果我來實作，我會在 server orchestration 裡維護這些變數：

createdProductId
createdListingId
createdConnectionId
uploadedR2Keys
insertedImageRowIds
notificationIds 或延後送通知
流程中只要任何一步失敗，就反向清理：

delete inserted image rows
delete uploaded R2 objects
delete parent record
不送通知，或刪通知
你這樣改順序後，能解掉哪些風險
風險 1
商品圖片上傳到 R2，但 confirm 失敗

你的新順序下：

product create 成功
upload product image 成功
confirm 失敗
rollback：delete R2 object + delete product
這個可以處理。

風險 2
上架圖片上傳到 R2，但 createListing 失敗

如果你改成先 create 再 upload，這個風險就直接消失了。
因為 createListing 會在 upload 前面。

風險 3
confirmListingImages delete 成功，但 insert 失敗

這個跟你調整 create 順序是兩件事。
這個問題還是要另外修 server/routers/upload.ts 裡的 confirm 流程。

也就是說：

你的新順序可以解 create flow 的殘留問題
但 edit flow 的 delete 再 insert 問題還是要用 transaction 修
我對這件事的結論
可以這樣做，而且是正確方向
你的順序比現在好，因為 rollback 比較好做。

但你不能只改順序，還要一起改這三件事
把 rollback 邏輯集中在 server 端，不要散在 client
延後通知等副作用，避免先通知後回滾
把 confirm images 改成 transaction，避免 delete 成功 insert 失敗
我最推薦的做法
Create flow
改成 server orchestration：

create parent record as rollbackable state
upload images
confirm image relations
finalize parent record
send side effects
失敗就：

delete uploaded R2 objects
delete parent record
abort side effects
Edit flow
把 listing 和 connection 的 confirm image 替換流程改成 DB transaction。

我的判斷
你這個方向是對的，我建議採用。
但如果你真的要做到你想要的「任何一步失敗，前面都不要留下來」，那就不要只改順序，還要一起做：

create flow 改成先建主紀錄再上傳圖
rollback 時同時刪 DB 和 R2
通知延後到最後一步
confirm image replace 改成 transaction
如果你要，我下一步可以直接幫你設計一個具體落地版本，包含：

listing create flow 要拆成哪幾個 server 動作
哪些 router 要改
rollback 要怎麼寫
notification 要延到哪一步
product、listing、connection 三條流程各自怎麼改最乾淨
如果你要更直接一點，我也可以下一則直接幫你畫出「改造後的完整時序圖」。

GPT-5.4 • 1x
