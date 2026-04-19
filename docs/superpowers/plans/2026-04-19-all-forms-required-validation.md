# All Forms Required Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every submission form in the app show inline red errors under required fields when the user tries to submit with missing values.

**Architecture:** Add one shared error-text component and move the client-side validation into each actual submit flow instead of relying on toast-only feedback. Keep search/filter inputs out of scope because they are intentionally optional and already behave like search boxes, not submission forms.

**Tech Stack:** Next.js App Router, React 19, TypeScript, base-ui/shadcn inputs, Zod where existing schemas already describe required fields, Playwright for end-to-end verification.

---

### Task 1: Add shared field error text

**Files:**
- Create: `components/shared/form-field-error.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { cn } from '@/lib/utils'

export function FormFieldError({ message, className }: { message?: string | null; className?: string }) {
  if (!message) return null

  return <p className={cn('mt-1 text-sm text-destructive', className)}>{message}</p>
}
```

- [ ] **Step 2: Verify the component compiles when imported by form files**

Run: `npm run lint`
Expected: no lint errors from the new component

### Task 2: Update form submission validation

**Files:**
- Modify: `components/connection/connection-form.tsx`
- Modify: `components/listing/listing-form.tsx`
- Modify: `components/review/review-form.tsx`
- Modify: `components/shared/report-dialog.tsx`
- Modify: `components/admin/product-edit-dialog.tsx`
- Modify: `app/(auth)/login/page.tsx`
- Modify: `app/(auth)/register/page.tsx`
- Modify: `app/(seller)/dashboard/profile/page.tsx`
- Modify: `app/(user)/settings/page.tsx`
- Modify: `app/(seller)/dashboard/listings/new/page.tsx`

- [ ] **Step 1: Add local error state to each form**

- [ ] **Step 2: Validate required fields before any mutation or navigation**

- [ ] **Step 3: Render red error text below each required field**

- [ ] **Step 4: Keep optional fields optional and do not show errors for empty optional fields**

- [ ] **Step 5: Verify the affected forms still submit successfully when valid**

Run: `npm run lint`
Expected: no lint errors in updated form files

### Task 3: Add regression coverage

**Files:**
- Modify: `tests/auth.spec.ts`
- Modify: `tests/listing.spec.ts`
- Modify: `tests/seller.spec.ts`

- [ ] **Step 1: Add tests for representative invalid submissions**

- [ ] **Step 2: Verify inline errors appear under fields instead of only toast feedback**

- [ ] **Step 3: Verify valid submissions still succeed**

Run: `npm test`
Expected: all relevant Playwright tests pass
