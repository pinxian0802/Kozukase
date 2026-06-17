'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Store, Check, Loader2 } from 'lucide-react'
import { FormFieldError } from '@/components/shared/form-field-error'
import { MultiSelect } from '@/components/ui/multi-select'
import { AvatarUpload } from '@/components/shared/avatar-upload'
import { uploadImageFiles } from '@/components/shared/image-upload'
import { trpc } from '@/lib/trpc/client'
import { useSession } from '@/lib/context/session-context'
import { toast } from 'sonner'
import Link from 'next/link'
import { PageBreadcrumb } from '@/components/shared/page-breadcrumb'
import Image from 'next/image'
import { useIgVerification } from '@/lib/hooks/use-ig-verification'
import { IgVerificationCard } from '@/components/seller/ig-verification-card'

// Accent palette — 每個步驟一色，刻意保留多彩設計。
// teal 已統一到 DS token；pink/purple/orange/yellow/green 待 Phase 4 收進 accent 色階。
const KZ = {
  teal: 'var(--brand-500)',
  pink: '#e94aa1',
  purple: '#9b5fc8',
  orange: '#f4821f',
  yellow: '#f5c518',
  green: '#72c442',
}


interface FormSectionProps {
  index: number
  accent: string
  title: string
  hint: string
  done: boolean
  required?: boolean
  meta?: string | null
  children: React.ReactNode
}

function FormSection({ index, accent, title, hint, done, required = true, meta, children }: FormSectionProps) {
  return (
    <section className="flex gap-[18px] items-start">
      <div className="flex flex-col items-center pt-0.5">
        <div
          style={{
            width: 34, height: 34, borderRadius: '50%',
            background: done ? accent : 'var(--surface-card)',
            border: `1px solid ${done ? accent : 'var(--border-soft)'}`,
            color: done ? 'var(--text-inverse)' : 'var(--text-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Rubik, sans-serif', fontWeight: 700, fontSize: 14,
            transition: 'background .25s, color .25s, border-color .25s',
            flexShrink: 0,
          }}
        >
          {done ? <Check size={14} strokeWidth={2.5} /> : index}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2.5 mb-1">
          <h2 className="font-semibold text-[17px] text-text-strong" style={{ fontFamily: 'Rubik, "Noto Sans TC", sans-serif' }}>
            {title}
            {required && <span className="text-foreground font-bold"> *</span>}
          </h2>
          {meta && <span className="text-[11.5px] text-text-muted tabular-nums">{meta}</span>}
        </div>
        <p className="text-[12.5px] text-text-muted leading-relaxed mb-3.5 max-w-[560px]">{hint}</p>
        {children}
      </div>
    </section>
  )
}


// 賣家權益圖示 — 與首頁分類同款 Fluent Emoji Flat（MIT），內嵌彩色 SVG body。
const PERK_ICONS = {
  // 購物袋 — 上架代購商品
  listing: '<g fill="none"><path fill="#F9C23C" d="M28.61 30H16.43c-.78 0-1.42-.632-1.42-1.424V15.424c0-.782.63-1.424 1.42-1.424h12.18c.78 0 1.42.632 1.42 1.424v13.162A1.42 1.42 0 0 1 28.61 30"/><path fill="#FF6723" d="M17.563 16.031a.5.5 0 0 1 .5.5v2.684c0 2.035 1.94 3.8 4.484 3.8c2.553 0 4.484-1.764 4.484-3.8V16.53a.5.5 0 0 1 1 0v2.684c0 2.721-2.522 4.8-5.484 4.8c-2.95 0-5.485-2.078-5.485-4.8V16.53a.5.5 0 0 1 .5-.5"/><path fill="#00A6ED" d="M18.13 27.966H3.73c-.95 0-1.73-.77-1.73-1.73V9.726c0-.95.77-1.73 1.73-1.73h14.4c.95 0 1.73.77 1.73 1.73v16.52c0 .95-.77 1.72-1.73 1.72"/><path fill="#0074BA" d="M11.016 2C7.746 2 5 4.375 5 7.425V10.5a.5.5 0 0 0 1 0V7.425C6 5.031 8.189 3 11.016 3s5.015 2.031 5.015 4.425V10.5a.5.5 0 0 0 1 0V7.425c0-3.05-2.746-5.425-6.015-5.425M2 14.69h17.86v2.33H2zm0 4.49h17.86v2.33H2zm17.86 4.49H2V26h17.86z"/></g>',
  // 飛機 — 發布連線代購
  trip: '<g fill="none"><path fill="#9B9B9B" d="m15 5.5l1.615-.512l.051-.052a1.14 1.14 0 0 0 .01-1.6a1.126 1.126 0 0 0-1.592-.011L14.022 4.38zm13.659 12.436l-.679.676L27 17.5l.442-1.415c.41-.169.9-.087 1.227.25a1.123 1.123 0 0 1-.01 1.601"/><path fill="#CDC4D6" d="m14.12 28.875l-1.348-5.554a26 26 0 0 0 4.825-3.61l3.428-3.254l3.443-1.551l1.943-3.563l2.295-2.18a4.163 4.163 0 0 0 .1-5.935a4.14 4.14 0 0 0-5.924.04L20.36 5.892l-4.1 1.727l-1.037 3.618l-2.96 3.08a26.2 26.2 0 0 0-3.646 4.813l-5.525-1.404a.9.9 0 0 0-.859.23c-.44.442-.2.993.24 1.454l9.95 10.087c.49.521 1.009.692 1.448.25a.9.9 0 0 0 .25-.872"/><path fill="#00A6ED" d="m27.793 5.77l-1.54-1.552a.73.73 0 0 0-1.032-.01a.713.713 0 0 0-.01 1.022l1.54 1.552a.73.73 0 0 0 1.032.01a.72.72 0 0 0 .01-1.022"/><path fill="#0084CE" d="m15.216 11.245l5.166-5.375L8.346 3.05c-.46-.11-.95-.04-1.37.19c-1.3.73-1.3 2.59-.01 3.32zm11.213.08l-5.42 5.147L25.46 24.7c.7 1.31 2.57 1.34 3.32.06c.24-.41.32-.89.22-1.36zM8.156 22.315a1.07 1.07 0 0 1 1.527.01c.43.421.42 1.111-.01 1.533L6.84 26.685a1.07 1.07 0 0 1-1.526-.01a1.08 1.08 0 0 1 .01-1.533z"/></g>',
  // 盾牌 — 獲得驗證徽章
  verified: '<g fill="none"><path fill="#E6E6E6" d="M12.096 2a2.78 2.78 0 0 0-1.9.694c-.837.75-.724 1.467-1.471 2.521A2.9 2.9 0 0 1 6.833 6.53l-.03.007a2.63 2.63 0 0 0-1.921 2.356c-.65 5.089 1.1 13 5.322 17.331a24.4 24.4 0 0 0 3.749 2.919a6.53 6.53 0 0 0 4.259 0a22.6 22.6 0 0 0 3.77-2.922c4.087-4.192 5.983-12.138 5.322-17.33a2.59 2.59 0 0 0-1.951-2.364a2.9 2.9 0 0 1-1.892-1.315c-.676-.954-.667-1.8-1.471-2.52a2.78 2.78 0 0 0-1.9-.695z"/><path fill="#AEDDFF" d="M20.009 3.5H16l-3.214 12.419L16 28.5c2 0 2-.5 4-2c0 0 6.5-4.5 6-17c0 0 .002-1.25-1-1.5c-2.5-.5-3.5-3.5-3.5-3.5c-.132-.334-.5-1-1.491-1"/><path fill="#00A6ED" d="M12.019 3.5h4.008v25c-2 0-2-.5-4-2c0 0-6.5-4.5-6-17c0 0-.002-1.25 1-1.5c2.5-.5 3.5-3.5 3.5-3.5c.132-.334.5-1 1.492-1"/></g>',
} as const

interface PerkProps {
  body: string
  title: string
  desc: string
}

function Perk({ body, title, desc }: PerkProps) {
  return (
    <div className="flex gap-3 items-start">
      <svg
        viewBox="0 0 32 32"
        className="w-9 h-9 flex-shrink-0"
        role="img"
        aria-hidden
        dangerouslySetInnerHTML={{ __html: body }}
      />
      <div>
        <div className="text-[13.5px] font-semibold text-text-strong mb-0.5">{title}</div>
        <div className="text-[12px] text-text-muted leading-[1.5]">{desc}</div>
      </div>
    </div>
  )
}

export default function BecomeSellerPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const session = useSession()
  const { data: regions } = trpc.seller.getRegions.useQuery()

  const NAME_MAX = 20
  const BIO_MAX = 300

  const [sellerName, setSellerName] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedRegions, setSelectedRegions] = useState<string[]>([])
  const [bio, setBio] = useState('')
  const [threads, setThreads] = useState('')
  const [insta, setInsta] = useState('')
  const [agree, setAgree] = useState(false)
  const [canProvideProof, setCanProvideProof] = useState<boolean | null>(null)
  const [avatarImage, setAvatarImage] = useState<{ url: string; r2Key: string } | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<{ sellerName?: string; phone?: string; regions?: string }>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(searchParams.get('preview') === 'submitted')

  const [igConnected, setIgConnected] = useState(false)
  const igVm = useIgVerification(() => setIgConnected(true))
  const adminHandle = process.env.NEXT_PUBLIC_INSTAGRAM_ADMIN_HANDLE ?? ''

  // Threads 驗證狀態機（私訊 + 管理員人工審核）
  type ThVerifyState =
    | { step: 'idle' }
    | { step: 'entering_username' }
    | { step: 'loading_code' }
    | { step: 'waiting_send'; id: string; code: string }
    | { step: 'reviewing'; id: string }
    | { step: 'rejected'; reason: string | null }

  const [thVerify, setThVerify] = useState<ThVerifyState>({ step: 'idle' })
  const [thUsernameInput, setThUsernameInput] = useState('')
  const [thInputError, setThInputError] = useState('')
  const threadsAdminHandle =
    process.env.NEXT_PUBLIC_THREADS_ADMIN_HANDLE ?? process.env.NEXT_PUBLIC_INSTAGRAM_ADMIN_HANDLE ?? ''

  const becomeSeller = trpc.seller.becomeSeller.useMutation()
  const getPresignedUrl = trpc.upload.getPresignedUrl.useMutation()
  const deleteObjects = trpc.upload.deleteObjects.useMutation()

  if (!session?.profile) return null

  if (session.isSeller && searchParams.get('preview') !== 'submitted' && searchParams.get('preview') !== 'form') {
    return (
      <div className="min-h-screen">
        <div className="mx-auto max-w-2xl px-3 py-3 md:px-4 md:py-8">
          <div className="border border-border-soft rounded-lg p-4 bg-white md:rounded-2xl md:p-6">
            <h2 className="font-semibold text-[17px] mb-1" style={{ fontFamily: 'Rubik, "Noto Sans TC", sans-serif' }}>
              你已經是賣家了
            </h2>
            <p className="text-[14px] text-text-muted mb-4">前往賣家後台管理你的上架商品</p>
            <Link href="/dashboard">
              <button className="h-11 px-5 rounded-xl bg-brand-500 text-cta-foreground text-[14px] font-semibold flex items-center gap-2 hover:bg-brand-700 transition-colors">
                <Store size={16} />前往賣家後台
              </button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const filled = [
    !!(avatarImage || pendingFile),
    sellerName.trim().length >= 2,
    selectedRegions.length > 0,
    bio.trim().length > 0,
    canProvideProof !== null,
  ]
  const filledCount = filled.filter(Boolean).length
  const pct = (filledCount / filled.length) * 100

  const isPending = isSubmitting || becomeSeller.isPending || getPresignedUrl.isPending

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const nextErrors: { sellerName?: string; regions?: string } = {}
    if (!sellerName.trim()) nextErrors.sellerName = '賣家名稱為必填'
    if (selectedRegions.length === 0) nextErrors.regions = '請至少選擇一個代購國家'
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }
    setErrors({})
    setIsSubmitting(true)

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
        region_ids: selectedRegions,
        bio: bio.trim() || undefined,
        avatar_url: finalAvatarUrl,
        can_provide_proof: canProvideProof ?? false,
      })

      toast.success('成功成為賣家！')
      setSubmitted(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err: unknown) {
      if (uploadedR2Key) {
        await deleteObjects.mutateAsync({ r2Keys: [uploadedR2Key] }).catch(() => {})
      }
      toast.error(err instanceof Error ? err.message : '操作失敗')
      setIsSubmitting(false)
    }
  }

  const handleThVerifyStart = async () => {
    const username = thUsernameInput.trim().toLowerCase()
    if (!username) { setThInputError('請輸入 Threads 帳號'); return }
    setThInputError('')
    setThVerify({ step: 'loading_code' })
    try {
      const res = await fetch('/api/threads/verify/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threads_username: username }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setThVerify({ step: 'waiting_send', id: data.id, code: data.code })
    } catch {
      toast.error('產生驗證碼失敗，請重試')
      setThVerify({ step: 'entering_username' })
    }
  }

  const cancelThVerify = () => {
    if (thVerify.step === 'waiting_send' || thVerify.step === 'reviewing') {
      const id = 'id' in thVerify ? thVerify.id : undefined
      if (id) {
        void fetch('/api/threads/verify/cancel', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        })
      }
    }
    setThVerify({ step: 'idle' })
    setThUsernameInput('')
    setThInputError('')
  }

  return (
    <div className="min-h-screen bg-white">
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '48px 24px 100px' }}>

        {/* Breadcrumb */}
        <PageBreadcrumb items={[{ label: '成為賣家' }]} />

        {/* Outer grid: left (hero + form) | right (sticky sidebar) */}
        <div className={submitted ? 'max-w-2xl mx-auto' : 'grid gap-12'} style={submitted ? {} : { gridTemplateColumns: '1fr 320px', alignItems: 'flex-start' }}>

          {/* LEFT: hero + form */}
          <div>
            {/* Hero */}
            <section className={`mb-9${submitted ? ' text-center' : ''}`}>
              <h1
                className="text-[38px] font-bold leading-[1.15] tracking-[-0.02em]"
                style={{ fontFamily: 'Rubik, "Noto Sans TC", sans-serif' }}
              >
                {submitted ? '恭喜成為' : '成為'}{' '}
                <Image
                  src="/logo.png"
                  alt="Kozukase"
                  width={510}
                  height={175}
                  priority
                  className="inline-block w-auto h-[1.5em] align-[-0.4em] mx-1"
                />{' '}
                賣家
              </h1>
              <p className="text-[15px] text-text-muted leading-[1.65] mt-3">
                {submitted ? '可以選擇連結社群帳號，增加買家對你的信任度。' : '完成下方資料就能開始上架代購，讓更多買家找到你。'}
              </p>
            </section>

          {/* 申請表單 */}
          {!submitted && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-7">
              <FormSection index={1} accent={KZ.pink} title="賣家頭貼" hint="建議用清楚、有辨識度的照片或 logo。" done={!!(avatarImage || pendingFile)}>
                <AvatarUpload value={avatarImage} onChange={setAvatarImage} pendingFile={pendingFile} onPendingFileChange={setPendingFile} />
              </FormSection>

              <FormSection index={2} accent={KZ.orange} title="賣家名稱" hint=' ' done={sellerName.trim().length >= 2}>
                <div className="relative">
                  <input
                    className="w-full h-11 border border-border-soft rounded-[10px] px-3.5 text-[14px] bg-white text-text-strong pr-14 transition-[border-color,box-shadow] focus:outline-none focus:border-text-strong focus:shadow-[0_0_0_3px_rgba(17,17,17,0.06)] hover:border-border-strong"
                    placeholder="例：潮流代購、東京小幫手"
                    value={sellerName}
                    maxLength={NAME_MAX}
                    onChange={e => { setSellerName(e.target.value); if (errors.sellerName) setErrors(c => { const n = { ...c }; delete n.sellerName; return n }) }}
                    onKeyDown={e => { if (e.key === 'Enter') e.preventDefault() }}
                    aria-invalid={!!errors.sellerName}
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11.5px] text-text-faint tabular-nums pointer-events-none">{sellerName.length}/{NAME_MAX}</span>
                </div>
                <FormFieldError message={errors.sellerName} />
              </FormSection>

              <FormSection index={3} accent={KZ.purple} title="代購國家" hint="可複選。主要前往代購的國家，至少選擇 1 個。" done={selectedRegions.length > 0} meta={selectedRegions.length > 0 ? `已選 ${selectedRegions.length} 個` : null}>
                <MultiSelect
                  value={selectedRegions}
                  onValueChange={(ids) => { setSelectedRegions(ids); if (errors.regions) setErrors(c => { const n = { ...c }; delete n.regions; return n }) }}
                  options={(regions ?? []).map((r: any) => ({ value: r.id, label: r.name }))}
                  placeholder="選擇代購國家" searchPlaceholder="搜尋國家..." emptyText="找不到相符的國家" invalid={!!errors.regions}
                />
                <FormFieldError message={errors.regions} />
              </FormSection>

              <FormSection index={4} accent={KZ.yellow} title="簡介" hint="介紹你的代購，幫助買家認識你。" done={bio.trim().length > 0}>
                <div className="relative">
                  <textarea
                    className="w-full min-h-[120px] resize-y border border-border-soft rounded-[10px] px-3.5 py-3 pb-8 text-[14px] leading-relaxed bg-white text-text-strong transition-[border-color,box-shadow] focus:outline-none focus:border-text-strong focus:shadow-[0_0_0_3px_rgba(17,17,17,0.06)] hover:border-border-strong"
                    placeholder="例：專營日本潮流選品，東京實體店面採購、附購買憑證。每週 2 班次穩定出貨，急件可加單，歡迎私訊討論。"
                    value={bio} maxLength={BIO_MAX} onChange={e => setBio(e.target.value)} rows={5}
                  />
                  <span className="absolute right-3.5 bottom-3 text-[11.5px] text-text-faint tabular-nums pointer-events-none">{bio.length}/{BIO_MAX}</span>
                </div>
              </FormSection>

              <FormSection index={5} accent={KZ.green} title="購買證明" hint="是否能提供購買證明？會顯示在你的賣家頁面，增加買家信任度。" done={canProvideProof !== null} required={false}>
                <div className="flex flex-col gap-2.5">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <button type="button" onClick={() => setCanProvideProof(true)}
                      className="w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-[border-color]"
                      style={{ borderColor: canProvideProof === true ? 'var(--text-strong)' : 'var(--border-strong)' }}
                    >
                      {canProvideProof === true && <div className="w-[10px] h-[10px] rounded-full" style={{ background: 'var(--text-strong)' }} />}
                    </button>
                    <span className="text-[13px] text-text-muted leading-[1.55]">可提供購買證明 / 明細（如收據、購買紀錄，協助買家辨別正品）</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <button type="button" onClick={() => setCanProvideProof(false)}
                      className="w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-[border-color]"
                      style={{ borderColor: canProvideProof === false ? 'var(--text-strong)' : 'var(--border-strong)' }}
                    >
                      {canProvideProof === false && <div className="w-[10px] h-[10px] rounded-full" style={{ background: 'var(--text-strong)' }} />}
                    </button>
                    <span className="text-[13px] text-text-muted leading-[1.55]">暫時無法提供</span>
                  </label>
                </div>
              </FormSection>

              {/* Agreement + submit */}
              <div className="flex flex-col gap-[18px]">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <button type="button" onClick={() => setAgree(v => !v)}
                    className="w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center flex-shrink-0 mt-0.5 transition-[background,border-color]"
                    style={{ background: agree ? 'var(--text-strong)' : 'var(--surface-card)', borderColor: agree ? 'var(--text-strong)' : 'var(--border-strong)', color: agree ? 'var(--text-inverse)' : 'transparent' }}
                  >
                    {agree && <Check size={11} strokeWidth={2.5} />}
                  </button>
                  <span className="text-[13px] text-text-muted leading-[1.55] pt-0.5">
                    我已閱讀並同意{' '}
                    <Link href="/seller-terms" target="_blank" className="text-text-strong underline underline-offset-2">賣家服務條款</Link>
                  </span>
                </label>
                <button
                  type="submit"
                  disabled={isPending || !agree || !filled.every(Boolean)}
                  className="h-[52px] px-7 rounded-xl bg-brand-500 text-cta-foreground text-[15px] font-semibold inline-flex items-center gap-2 transition-[background,transform] hover:bg-brand-700 active:translate-y-px disabled:bg-border-strong disabled:cursor-not-allowed w-fit"
                >
                  {isPending ? '送出中…' : '送出申請'}
                </button>
              </div>
            </form>
          )}

          {/* 成為賣家後：社群連結 */}
          {submitted && (
            <div className="flex flex-col gap-6">

              {thVerify.step !== 'idle' ? (

                /* ── Threads 驗證流程 ── */
                <div className="rounded-2xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.08)] p-5 flex items-center justify-center mx-auto w-full max-w-[500px]" style={{ height: 360 }}>
                <div className="w-full max-w-[300px]">

                  {thVerify.step === 'entering_username' && (
                    <div className="flex flex-col gap-7">
                      <div className="flex flex-col items-center gap-3.5 text-center">
                        <div className="w-14 h-14 rounded-2xl overflow-hidden">
                          <Image src="/images/threads.png" alt="Threads" width={56} height={56} />
                        </div>
                        <div>
                          <p className="font-semibold text-[15px] text-text-strong">驗證 Threads</p>
                          <p className="text-[13px] text-text-muted mt-1 leading-relaxed">輸入你的帳號名稱</p>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <input
                          className="w-full h-11 px-3.5 rounded-xl border border-border-soft bg-white text-[14px] text-text-strong placeholder:text-text-faint focus:outline-none focus:border-text-strong focus:shadow-[0_0_0_3px_rgba(17,17,17,0.06)] transition-[border-color,box-shadow]"
                          placeholder="帳號名稱"
                          value={thUsernameInput}
                          onChange={e => { setThUsernameInput(e.target.value); setThInputError('') }}
                          onKeyDown={e => { if (e.key === 'Enter') void handleThVerifyStart() }}
                          autoFocus
                        />
                        <FormFieldError message={thInputError} />
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => void handleThVerifyStart()}
                          className="h-11 w-full rounded-xl bg-white text-brand-500 border border-brand-500 text-[14px] font-semibold hover:bg-brand-50 active:translate-y-px transition-[background,transform]"
                        >
                          取得驗證碼
                        </button>
                        <button onClick={cancelThVerify} className="h-10 w-full rounded-xl text-[13px] text-text-muted hover:text-text-strong transition-colors">
                          取消
                        </button>
                      </div>
                    </div>
                  )}

                  {thVerify.step === 'loading_code' && (
                    <div className="flex flex-col items-center gap-5 py-10 text-center">
                      <div className="flex items-center gap-2 text-text-muted">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-[13px]">正在產生驗證碼⋯</span>
                      </div>
                    </div>
                  )}

                  {thVerify.step === 'waiting_send' && (
                    <div className="flex flex-col gap-6">
                      <div className="text-center space-y-1">
                        <p className="font-semibold text-[15px] text-text-strong">傳送驗證碼</p>
                        <p className="text-[13px] text-text-muted leading-relaxed">
                          用 Threads 私訊以下數字給{' '}
                          <a href={`https://www.threads.net/@${threadsAdminHandle}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-text-strong hover:underline">
                            @{threadsAdminHandle}
                          </a>
                        </p>
                        <p className="text-[13px] text-text-muted leading-relaxed">傳送後請點擊『<span className="text-text-strong">我已傳送</span>』按鈕</p>
                      </div>
                      <div className="flex justify-center gap-2">
                        {thVerify.code.toString().split('').map((digit, i) => (
                          <div key={i} className="flex items-center justify-center rounded-xl border-2 border-border-soft bg-surface-muted text-[22px] font-mono font-bold text-text-strong shadow-sm" style={{ width: 40, height: 52 }}>
                            {digit}
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => setThVerify({ step: 'reviewing', id: thVerify.id })}
                          className="h-11 w-full rounded-xl bg-white text-brand-500 border border-brand-500 text-[14px] font-semibold hover:bg-brand-50 active:translate-y-px transition-[background,transform]"
                        >
                          我已傳送
                        </button>
                        <button onClick={cancelThVerify} className="h-10 w-full rounded-xl text-[13px] text-text-muted hover:text-text-strong transition-colors">
                          取消
                        </button>
                      </div>
                    </div>
                  )}

                  {thVerify.step === 'reviewing' && (
                    <div className="flex flex-col items-center gap-6 py-6 text-center">
                      <div className="w-[72px] h-[72px] rounded-2xl overflow-hidden">
                        <Image src="/images/threads.png" alt="Threads" width={72} height={72} />
                      </div>
                      <div className="space-y-1.5">
                        <p className="font-semibold text-[16px] text-text-strong">審核中</p>
                        <p className="text-[13px] text-text-muted leading-relaxed">我們已收到你的驗證，管理員審核通過後會以通知告知你。你可以先離開這個頁面。</p>
                      </div>
                      <button onClick={cancelThVerify} className="h-10 px-10 rounded-xl text-[13px] text-text-muted hover:text-text-strong transition-colors">
                        取消申請
                      </button>
                    </div>
                  )}

                  {thVerify.step === 'rejected' && (
                    <div className="flex flex-col items-center gap-6 py-6 text-center">
                      <div className="relative">
                        <div className="w-[72px] h-[72px] rounded-2xl overflow-hidden">
                          <Image src="/images/threads.png" alt="Threads" width={72} height={72} />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-[22px] h-[22px] rounded-full bg-red-500 border-2 border-white flex items-center justify-center">
                          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3.5} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <p className="font-semibold text-[16px] text-text-strong">驗證未通過</p>
                        <p className="text-[13px] text-text-muted">{thVerify.reason || '管理員未通過這次驗證，請確認已把驗證碼私訊給正確帳號後重試'}</p>
                      </div>
                      <button
                        onClick={() => { setThVerify({ step: 'entering_username' }); setThUsernameInput('') }}
                        className="h-11 px-10 rounded-xl bg-white text-brand-500 border border-brand-500 text-[14px] font-semibold hover:bg-brand-50 active:translate-y-px transition-[background,transform]"
                      >
                        重新驗證
                      </button>
                    </div>
                  )}

                </div>
                </div>

              ) : igVm.state.step !== 'idle' ? (

                /* ── IG 驗證流程 ── */
                <div className="rounded-2xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.08)] p-5 flex items-center justify-center mx-auto w-full max-w-[500px]" style={{ height: 360 }}>
                <div className="w-full max-w-[300px]">

                  <IgVerificationCard vm={igVm} adminHandle={adminHandle} />

                </div>
                </div>

              ) : (

                /* ── 雙欄卡片 ── */
                <div className="grid grid-cols-2 gap-4">

                  {/* Instagram Card */}
                  {igConnected ? (
                    <div className="rounded-2xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.08)] p-6 flex items-center justify-center min-h-[175px]">
                      <div className="flex items-center gap-4">
                        <div className="relative flex-shrink-0">
                          <div className="w-14 h-14 rounded-[14px] overflow-hidden">
                            <Image src="/images/instagram.png" alt="Instagram" width={56} height={56} />
                          </div>
                          <div className="absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-full bg-green-500 border-2 border-white flex items-center justify-center">
                            <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                          </div>
                        </div>
                        <div>
                          <p className="text-[15px] font-semibold text-text-strong">Instagram</p>
                          <p className="text-[13px] text-text-muted mt-0.5">@{igVm.usernameInput}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.08)] p-6 flex flex-col justify-between min-h-[175px]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-[10px] overflow-hidden shadow-[0_2px_10px_rgba(221,42,123,0.12)]">
                          <Image src="/images/instagram.png" alt="Instagram" width={40} height={40} />
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-text-strong">Instagram</p>
                          <p className="text-[11.5px] text-text-faint">尚未連結</p>
                        </div>
                      </div>
                      {igVm.pendingId ? (
                        <button
                          onClick={() => igVm.setState({ step: 'reviewing', id: igVm.pendingId! })}
                          className="h-9 w-full rounded-xl bg-white text-brand-500 border border-brand-500 text-[13px] font-medium hover:bg-brand-50 active:translate-y-px transition-[background,transform]"
                        >
                          審核中
                        </button>
                      ) : (
                        <button
                          onClick={() => igVm.setState({ step: 'entering_username' })}
                          className="h-9 w-full rounded-xl bg-white text-brand-500 border border-brand-500 text-[13px] font-medium hover:bg-brand-50 active:translate-y-px transition-[background,transform]"
                        >
                          驗證
                        </button>
                      )}
                    </div>
                  )}

                  {/* Threads Card */}
                  <div className="rounded-2xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.08)] p-6 flex flex-col justify-between min-h-[175px]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-[10px] overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
                        <Image src="/images/threads.png" alt="Threads" width={40} height={40} />
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-text-strong">Threads</p>
                        <p className="text-[11.5px] text-text-faint">尚未連結</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setThVerify({ step: 'entering_username' })}
                      className="h-9 w-full rounded-xl bg-white text-brand-500 border border-brand-500 text-[13px] font-medium hover:bg-brand-50 active:translate-y-px transition-[background,transform]"
                    >
                      驗證
                    </button>
                  </div>

                </div>

              )}

              <div className="max-w-[500px] mx-auto w-full flex justify-end">
                <button
                  onClick={() => { void igVm.cancel(); router.push('/dashboard') }}
                  className="h-[52px] px-7 rounded-xl bg-brand-500 text-cta-foreground text-[15px] font-semibold inline-flex items-center gap-2 hover:bg-brand-700 active:translate-y-px transition-[background,transform]"
                >
                  {igConnected ? '完成' : '先暫時跳過'}
                </button>
              </div>
            </div>
          )}
          </div>{/* end left column */}

          {/* RIGHT: sticky sidebar */}
          {!submitted && <aside className="flex flex-col gap-4 self-start sticky top-24 md:top-[136px]">

            {/* Progress */}
            <div className="border border-border-soft rounded-[14px] p-5 bg-white">
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-[11px] font-medium text-text-muted uppercase tracking-[.05em]">完成度</span>
                <span className="text-[15px] font-bold" style={{ fontFamily: 'Rubik, sans-serif' }}>
                  {filledCount}<span className="text-text-faint"> / {filled.length}</span>
                </span>
              </div>
              <div className="h-1.5 bg-surface-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${KZ.teal}, ${KZ.purple}, ${KZ.pink}, ${KZ.orange})`,
                    transition: 'width .35s ease',
                  }}
                />
              </div>
              <div className="text-[11.5px] text-text-faint mt-2">填完全部欄位即可送出申請</div>
            </div>

            {/* Perks */}
            <div className="border border-border-soft rounded-[14px] p-5">
              <div className="text-[11px] font-medium text-text-muted uppercase tracking-[.05em] mb-3.5">賣家可以做什麼</div>
              <div className="flex flex-col gap-3.5">
                <Perk
                  body={PERK_ICONS.listing}
                  title="上架代購商品"
                  desc="發布商品圖、價格、出貨時間等等資訊"
                />
                <Perk
                  body={PERK_ICONS.trip}
                  title="發布連線代購"
                  desc="公告出國代購連線行程，集中收單。"
                />
                <Perk
                  body={PERK_ICONS.verified}
                  title="獲得驗證徽章"
                  desc="完成審核後，賣家頁面顯示已驗證標記。"
                />
              </div>
            </div>

            {/* Help */}
            <div className="text-[11.5px] text-text-muted leading-relaxed px-1">
              有問題？{' '}
              <a href="mailto:contact@kozukase.com" className="text-text-strong underline underline-offset-2">聯絡客服</a>
            </div>
          </aside>}
        </div>
      </div>
    </div>
  )
}
