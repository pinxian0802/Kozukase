# next/image R2 host issue

## Problem
Using `next/image` with an R2 public URL caused a runtime error when the hostname was not configured in `next.config.ts`.

## Fix
Allow R2 public image hosts in `next.config.ts` before using their URLs inside `next/image`.

## Places checked
- `app/(seller)/dashboard/listings/new/page.tsx`
- `components/product/product-search.tsx`

These are the only `next/image` call sites that render R2-hosted product images.

## Rule for future changes
- If an image URL comes from R2 or any other remote host, add that host to `next.config.ts` first.
- If the host cannot be configured, use a plain `<img>` instead of `next/image`.
- Re-check any new product or listing card that renders catalog images, because they are the most likely places to reintroduce this issue.
