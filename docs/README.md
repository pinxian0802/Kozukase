# Kozukase 文件索引

平台所有設計、流程、運維文件都收在這個資料夾。

> **文件分類原則**
> - `platform-overview.md` 是唯一的「平台全貌」文件——功能、角色、路由、規則都在這裡
> - 獨立文件只用於「step-by-step 技術流程」或「純參考表」
> - 工程備忘、踩坑紀錄 → `notes/<topic>.md`
> - 改功能時，若涉及文件描述的行為，需一併更新

---

## 平台全貌

| 文件 | 用途 |
|------|------|
| [platform-overview.md](./platform-overview.md) | 系統定位、角色、功能模組、路由結構、業務限制——**主要參考這份** |

## 流程細節（overview 的延伸）

| 文件 | 用途 |
|------|------|
| [auth-flow.md](./auth-flow.md) | 登入 / 註冊技術流程（OAuth、Magic Link、Onboarding、Middleware 保護層） |
| [listing-product-removed-flow.md](./listing-product-removed-flow.md) | 商品被移除後代購重選與重送的完整步驟 |

## 參考表

| 文件 | 用途 |
|------|------|
| [field-length-limits.md](./field-length-limits.md) | 全站使用者輸入欄位的長度限制總表 |

## 運維 / 法律

| 文件 | 用途 |
|------|------|
| [report-handling-sop.md](./report-handling-sop.md) | 檢舉處理 SOP（內部） |
| [seller-listing-guidelines.md](./seller-listing-guidelines.md) | 賣家上架紅線指引 |
| [terms-of-service.md](./terms-of-service.md) | 使用者服務條款 |
| [privacy-policy.md](./privacy-policy.md) | 隱私政策 |

## 第三方整合

| 文件 | 用途 |
|------|------|
| [threads-oauth-integration.md](./threads-oauth-integration.md) | Threads OAuth 串接實作說明 |

## 前端 Design System

| 文件 | 用途 |
|------|------|
| [design-system/README.md](./design-system/README.md) | Design System 入口 |
| [design-system/tokens.md](./design-system/tokens.md) | 顏色 / spacing / typography 完整清單 |
| [design-system/components.md](./design-system/components.md) | 元件 + variants 速查 |
| [design-system/patterns.md](./design-system/patterns.md) | 常用 UI 組合範例 |
| [design-system/migration.md](./design-system/migration.md) | 硬碼 hex → token 對照表 |

## 工程備忘（notes）

踩坑紀錄、設定備忘、開發者參考。

| 文件 | 主題 |
|------|------|
| [notes/image-upload-and-display.md](./notes/image-upload-and-display.md) | 圖片上傳與顯示邏輯總覽（壓縮、thumbnail、fallback） |
| [notes/next-image-r2-host.md](./notes/next-image-r2-host.md) | `next/image` 與 R2 host 設定的踩坑 |
| [notes/product-image-fallback.md](./notes/product-image-fallback.md) | 商品圖片的 fallback 邏輯 |
| [notes/shadcn-ui-setup.md](./notes/shadcn-ui-setup.md) | shadcn/ui 設定備忘 |
| [notes/filter-optimistic-ui.md](./notes/filter-optimistic-ui.md) | 篩選 UI 即時反應模式的解法 |
| [notes/postgrest-column-cast-pitfall.md](./notes/postgrest-column-cast-pitfall.md) | PostgREST 欄位 cast 靜默失效的大坑 |

---

## 文件結構

```
docs/
├── README.md                       ← 你正在看的索引
├── platform-overview.md            ← 唯一的「平台全貌」文件
├── auth-flow.md                    ← 登入技術流程（延伸）
├── listing-product-removed-flow.md ← 商品移除重選流程（延伸）
├── field-length-limits.md          ← 欄位長度參考表
├── report-handling-sop.md          ← 檢舉 SOP（內部）
├── seller-listing-guidelines.md    ← 賣家上架規範
├── threads-oauth-integration.md    ← Threads 整合說明
├── terms-of-service.md             ← 服務條款
├── privacy-policy.md               ← 隱私政策
├── design-system/                  ← 前端 token / 元件速查
└── notes/                          ← 工程踩坑備忘
```
