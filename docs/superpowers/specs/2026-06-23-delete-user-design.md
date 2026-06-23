# 刪除使用者功能 — 設計探討（討論中，尚未定案）

狀態：**討論中，待決定**。本文件記錄到 2026-06-23 為止的討論、調查結果、已確認的決策與尚未拍板的問題，方便之後接續。

---

## 一、需求背景

管理員需要能在後台**刪除一個使用者**，刪除後把這個人相關的資料一併清掉，**唯一例外是他建立的共用商品目錄要保留**。

目前系統完全沒有「刪除使用者」的能力，而且資料庫的外鍵設定會讓刪除動作被擋下來（見第四節）。

---

## 二、已確認的決策

1. **觸發情境**：管理員在後台手動刪除（不是使用者自助註銷）。
2. **賣場資料**：被刪的人若是賣家，他的**賣家檔案、刊登報價、代購團全部一起刪掉**，只保留他建過的共用商品目錄。
3. **私訊對話**：對話與訊息**保留**，只把發送者改成「已刪除使用者」（匿名化），讓沒被刪的對方還看得到歷史。

---

## 三、尚未決定的關鍵問題

**「刪除」的強度**，三選一：

- A. 真正永久刪除、不可復原。
- B. 其實比較想要「停權／隱藏」這種可復原的處置。
- C. 兩者都要（平常先停權，確定了再永久刪）。

> 此題會影響：要不要把「停權」補成可用在一般使用者（買家）身上，還是專心把「刪除」做好。使用者目前傾向再想想。

---

## 四、資料庫現況調查（指向使用者的所有關聯）

系統的「使用者」其實是兩張表：`auth.users`（登入帳號）與 `profiles`（個人資料），兩者 id 相同、一對一。刪登入帳號會連帶刪 `profiles`，但底下一堆資料指著 `profiles`，預設設定會擋住刪除。

「使用者」相關外鍵的現況與**規劃處置**：

| 資料 | 欄位 | 目前刪除行為 | 規劃處置 |
|------|------|------|------|
| 商品（建立者） | `products.created_by` | 已改為 SET NULL（檔案 00052，**尚未套用**） | 保留商品，欄位清空 |
| 商品（下架者） | `products.removed_by` | NO ACTION（會擋） | 改 SET NULL，保留商品 |
| 商品圖片 | `product_images.uploaded_by` | NO ACTION（會擋） | 改 SET NULL，**保留圖片**（商品要留就要留圖） |
| 私訊對話雙方 | `conversations.buyer_id` / `seller_id` | CASCADE（會連帶刪整串對話） | 改 nullable + SET NULL，保留對話、匿名化 |
| 訊息發送者 | `messages.sender_id` | NO ACTION（會擋） | 改 nullable + SET NULL，保留訊息、匿名化 |
| 檢舉處理者 | `reports.resolved_by` | NO ACTION（會擋） | 改 SET NULL，保留檢舉紀錄 |
| 賣家檔案 | `sellers.id` | CASCADE | 刪除（連帶賣家所有子資料） |
| 刊登 | `listings` + `listing_images` | 隨賣家 | 刪除 |
| 代購團 | `connections` + 圖片 | 隨賣家 | 刪除 |
| 評價（他寫的／別人給他賣家的） | `reviews.reviewer_id` / `seller_id` | NO ACTION／隨賣家 | 刪除 |
| 評價按讚 | `review_likes.user_id` | NO ACTION（會擋） | 刪除 |
| 檢舉（他檢舉的） | `reports.reporter_id` | NO ACTION（會擋） | 刪除 |
| 通知 | `notifications.recipient_id` | NO ACTION（會擋） | 刪除 |
| 收藏 | `product_bookmarks` / `listing_bookmarks` / `connection_bookmarks` | NO ACTION（會擋） | 刪除 |
| 追蹤 | `follows.follower_id` / `seller_id` | NO ACTION／隨賣家 | 刪除 |
| 許願 | `wishes.user_id` | NO ACTION（會擋） | 刪除 |
| 各種瀏覽／點擊紀錄 | `*_views.viewer_id` 等 | 已是 SET NULL | 維持（自動清空） |

> 註：上表「規劃處置」是依目前決策推導，尚未經使用者逐項確認，實作前需再核對。對話／訊息匿名化後，**前端顯示對話對象的地方需要處理空值**（顯示「已刪除使用者」）。

**驗證真實資料庫的唯讀 SQL**（貼到 Supabase 後台 SQL Editor 執行）：

```sql
select
  ref.relname  as 指向的表,
  rel.relname  as 來源表,
  att.attname  as 欄位,
  case con.confdeltype
    when 'a' then 'NO ACTION（會擋）'
    when 'r' then 'RESTRICT（會擋）'
    when 'c' then 'CASCADE（連帶刪）'
    when 'n' then 'SET NULL（自動清空）'
    when 'd' then 'SET DEFAULT'
  end as 刪除行為
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_class ref on ref.oid = con.confrelid
join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any(con.conkey)
where con.contype = 'f'
  and ref.relname = 'profiles'
order by 刪除行為, 來源表;
```

---

## 五、現有的停權功能現況

- **只有「賣家停權」一套機制**（改賣家檔案上的「已停權」標記），有兩個入口：
  - 後台直接停權（`suspendSeller` / `unsuspendSeller`）
  - 處理檢舉時，若檢舉對象是賣家，會一併停權
- 停權效果：下架其所有刊登、結束代購團、發通知；前台會隱藏該賣家。**可復原、資料保留、帳號仍可登入**。
- 檢舉處理對其他對象的處置：檢舉刊登→下架、檢舉代購團→結束、檢舉評價→隱藏。
- **缺口**：一般使用者（買家）無法停用；完全沒有刪除功能；後台「使用者管理」頁面目前只能搜尋與切換管理員權限。

---

## 六、目前已動到的東西

目前**沒有任何改動殘留**。先前曾建立 `00052_product_created_by_nullable.sql`（把 `products.created_by` 改 SET NULL）並順手調整 `server/db/types.ts` 型別，但兩者皆已**撤回**（migration 從未套用到資料庫，型別已還原）。程式碼與資料庫均回到原狀。

> 待整套「刪除使用者」設計定案後，再把所有外鍵調整（商品、圖片、下架者、對話、訊息等）整併成一個完整一致的 migration，一次到位。

---

## 七、實作做法候選（尚未選定）

- **做法一（建議）：由資料庫外鍵連鎖處理**。事先把每種關聯設成 CASCADE（該刪）或 SET NULL（該留），刪登入帳號一個動作即自動完成。最可靠、不易漏；代價是要寫一個較大的一次性外鍵調整。
- **做法二：後端程式逐表刪除**。邏輯看得到、不動結構；但易漏表、順序錯會失敗、中途失敗可能刪一半、新增表要回頭維護。
- **做法三：資料庫函式包成單一交易**。避免刪一半；但函式維護較吃力、一樣要手動列全表。

---

## 八、下一步

1. 使用者決定第三節的「刪除強度」（永久刪／停權／兩者）。
2. 逐項確認第四節的處置表。
3. 選定實作做法。
4. 定案後整併 migration，並規劃前端匿名化顯示。
