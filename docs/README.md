# Kozukase 文件索引

平台所有設計、流程、運維文件都收在這個資料夾。下方依「目的」分類。

> **新文件命名慣例**
> - 一次性的設計 / 規格 → `specs/YYYY-MM-DD-<topic>.md`
> - 短期 implementation plan → `superpowers/plans/YYYY-MM-DD-<topic>.md`
> - 永久參照的流程說明 → 放在 `docs/` 根目錄，使用穩定檔名（無日期）
> - 工程備忘、踩坑紀錄 → `notes/<topic>.md`

---

## 一、平台總覽 & 流程

| 文件 | 用途 |
|------|------|
| [platform-overview.md](./platform-overview.md) | 系統定位、角色（買家/賣家/管理員）、權限矩陣 |
| [auth-flow.md](./auth-flow.md) | 登入 / 註冊流程（Google OAuth、Email Magic Link、Email/Password） |
| [buyer-flow.md](./buyer-flow.md) | 買家頁面、操作、互動規則 |
| [seller-flow.md](./seller-flow.md) | 賣家上架、連線公告、後台操作 |

## 二、安全性

| 文件 | 用途 |
|------|------|
| [security-review.md](./security-review.md) | **全站安全性審查報告（2026-04-28）**：API 防禦層、發現的問題與修正、後續建議 |

## 三、法律文件

| 文件 | 用途 |
|------|------|
| [terms-of-service.md](./terms-of-service.md) | 使用者服務條款（14 條）：帳號、賣家義務、禁止行為、智財、免責、準據法 |
| [privacy-policy.md](./privacy-policy.md) | 隱私政策（13 條 + 2 附錄）：資料蒐集、加密儲存、第三方共享、個資法六大權利、違反通知程序 |

## 四、第三方整合

| 文件 | 用途 |
|------|------|
| [threads-oauth-integration.md](./threads-oauth-integration.md) | Threads OAuth 串接實作說明（運行中） |
| [superpowers/specs/2026-04-20-ig-threads-oauth-integration-design.md](./superpowers/specs/2026-04-20-ig-threads-oauth-integration-design.md) | IG / Threads OAuth 整合的原始設計文件 |

## 五、設計規格（specs）

凍結時點的設計快照，記錄當時的決策與權衡。

| 文件 | 主題 |
|------|------|
| [specs/2026-04-14-daigo-platform-design.md](./specs/2026-04-14-daigo-platform-design.md) | 代購比價平台主規格（Master Spec） |
| [specs/2026-04-17-create-listing-flow.md](./specs/2026-04-17-create-listing-flow.md) | 「新增代購」完整流程 |
| [specs/2026-04-17-rollback-design.md](./specs/2026-04-17-rollback-design.md) | 圖片上傳與建立流程的 rollback 機制 |

## 六、Implementation Plans（superpowers/plans）

由 superpowers 工具產生的逐步實作計畫，已完成或進行中。

| 文件 | 主題 |
|------|------|
| [superpowers/plans/2026-04-19-all-forms-required-validation.md](./superpowers/plans/2026-04-19-all-forms-required-validation.md) | 全站表單必填欄位驗證 |
| [superpowers/plans/2026-04-26-product-search-aliases.md](./superpowers/plans/2026-04-26-product-search-aliases.md) | 商品搜尋 aliases 支援 |
| [superpowers/plans/2026-04-26-seller-avatar.md](./superpowers/plans/2026-04-26-seller-avatar.md) | 賣家頭貼功能 |

## 七、工程備忘（notes）

踩坑紀錄、設定備忘、開發者參考。

| 文件 | 主題 |
|------|------|
| [notes/image-upload-and-display.md](./notes/image-upload-and-display.md) | 圖片上傳與顯示邏輯總覽 |
| [notes/next-image-r2-host.md](./notes/next-image-r2-host.md) | `next/image` 與 R2 host 設定的踩坑紀錄 |
| [notes/product-image-fallback.md](./notes/product-image-fallback.md) | 商品圖片的 fallback 邏輯 |
| [notes/shadcn-ui-setup.md](./notes/shadcn-ui-setup.md) | shadcn/ui 設定備忘 |

---

## 文件分層說明

```
docs/
├── README.md                  ← 你正在看的索引
├── platform-overview.md       ← 系統總覽（穩定）
├── auth-flow.md               ← 認證流程（穩定）
├── buyer-flow.md              ← 買家流程（穩定）
├── seller-flow.md             ← 賣家流程（穩定）
├── security-review.md         ← 安全性審查（每次審查後追加章節）
├── threads-oauth-integration.md  ← 第三方整合說明（穩定）
│
├── specs/                     ← 凍結時點的設計規格
├── superpowers/
│   ├── specs/                 ← superpowers 工具產生的設計
│   └── plans/                 ← superpowers 工具產生的實作計畫
└── notes/                     ← 工程備忘、踩坑紀錄
```
