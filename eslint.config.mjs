import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Design System v1 — 禁止硬碼 hex / Tailwind arbitrary 顏色值
// 規格：docs/specs/2026-05-21-design-system-plan.md
// 例外清單見下方 ignore patterns（auth Google SVG、avatar gradient 等）
const DS_NO_HEX_RULES = {
  "no-restricted-syntax": [
    "error",
    {
      // 禁止 Tailwind arbitrary 顏色值：bg-[#...] / text-[#...] / border-[#...] / fill-[#...] / stroke-[#...] / from-[#...] / to-[#...] 等
      selector:
        "Literal[value=/(bg|text|border|fill|stroke|from|to|via|ring|outline|decoration|accent|shadow|placeholder|caret)-\\[#[0-9a-fA-F]{3,8}/]",
      message:
        "禁止 Tailwind arbitrary 顏色值（如 bg-[#fff]）。請用 design system token：bg-surface-card / text-text-strong / border-border-soft / bg-brand-500 等。詳見 docs/design-system/tokens.md。",
    },
    {
      // 禁止 className / style 字串裡的純 hex（會被 JSX literal 抓到）
      selector:
        "JSXAttribute[name.name=/^(className|style)$/] Literal[value=/['\"\\s:({,>][#][0-9a-fA-F]{3,8}/]",
      message:
        "禁止在 className/style 寫硬碼 hex。請用 token：var(--text-strong) / var(--surface-card) / var(--brand-500) 等。詳見 docs/design-system/tokens.md。",
    },
  ],
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Design System rules — 套用到 app/ 與 components/ 的 .tsx
  {
    files: ["app/**/*.tsx", "app/**/*.ts", "components/**/*.tsx", "components/**/*.ts"],
    ignores: [
      // Auth 頁面 Google OAuth SVG 服務色（intentional）
      "app/\\(auth\\)/login/**",
      "app/\\(auth\\)/register/**",
      // 已知保留的有意 hex（accent palette、avatar gradient、LINE 服務色）；
      // 註：glob 中 `[id]` 被當字元類，須用 `**` 通配；同理 `()` 在 picomatch 下需轉義。
      "app/\\(user\\)/become-seller/**",
      "components/shared/share-popover.tsx",
      "components/message/conversation-list.tsx",
      "components/message/conversation-panel.tsx",
      "components/message/context-card.tsx",
      "app/\\(buyer\\)/sellers/**",
      "app/\\(buyer\\)/search/**",
    ],
    rules: DS_NO_HEX_RULES,
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
