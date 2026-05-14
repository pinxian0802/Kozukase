'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Store, Check } from 'lucide-react'
import { FormFieldError } from '@/components/shared/form-field-error'
import { MultiSelect } from '@/components/ui/multi-select'
import { AvatarUpload } from '@/components/shared/avatar-upload'
import { uploadImageFiles } from '@/components/shared/image-upload'
import { trpc } from '@/lib/trpc/client'
import { useSession } from '@/lib/context/session-context'
import { toast } from 'sonner'
import Link from 'next/link'
import { PageBreadcrumb } from '@/components/shared/page-breadcrumb'

const KZ = {
  teal: '#3ecfcf',
  pink: '#e94aa1',
  purple: '#9b5fc8',
  orange: '#f4821f',
  yellow: '#f5c518',
  green: '#72c442',
}

function ThreadsIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 192 192" fill="currentColor">
      <path d="M141.537 88.988a66.667 66.667 0 0 0-2.518-1.143c-1.482-27.307-16.403-42.94-41.457-43.1h-.34c-14.986 0-27.449 6.396-35.13 18.043l13.779 9.452c5.74-8.706 14.747-10.555 21.358-10.555h.229c8.234.052 14.45 2.447 18.474 7.117 2.93 3.402 4.89 8.103 5.86 14.03-7.304-1.241-15.2-1.623-23.642-1.14-23.786 1.371-39.082 15.246-38.055 34.53.521 9.78 5.391 18.193 13.71 23.69 7.027 4.643 16.078 6.913 25.484 6.397 12.421-.681 22.164-5.408 28.96-14.064 5.16-6.571 8.42-15.05 9.84-25.54 5.83 3.52 10.156 8.157 12.554 13.74 4.075 9.467 4.282 24.987-8.428 37.643-11.135 11.108-24.578 15.94-45.012 16.094-22.728-.165-39.913-7.51-51.025-21.823C92.83 161.99 8.523 153.196 8.523 96.176c0-57.022 56.07-87.83 95.949-87.83 22.86 0 41.696 8.74 56.142 19.79 14.196 10.86 25.043 25.6 31.06 41.948z" />
    </svg>
  )
}

function InstagramIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  )
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
            background: done ? accent : '#fff',
            border: `1px solid ${done ? accent : '#e0e0e0'}`,
            color: done ? '#fff' : '#888',
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
          <h2 className="font-semibold text-[17px] text-[#111]" style={{ fontFamily: 'Rubik, "Noto Sans TC", sans-serif' }}>
            {title}
            {required && <span style={{ color: KZ.pink, fontWeight: 700 }}> *</span>}
          </h2>
          {meta && <span className="text-[11.5px] text-[#888] tabular-nums">{meta}</span>}
        </div>
        <p className="text-[12.5px] text-[#888] leading-relaxed mb-3.5 max-w-[560px]">{hint}</p>
        {children}
      </div>
    </section>
  )
}

interface SocialFieldProps {
  platform: string
  icon: React.ReactNode
  iconBg: string
  value: string
  onChange: (v: string) => void
  placeholder: string
}

function SocialField({ platform, icon, iconBg, value, onChange, placeholder }: SocialFieldProps) {
  return (
    <div className="flex items-stretch">
      <span
        className="h-11 inline-flex items-center gap-2 px-3 border border-r-0 rounded-l-[10px] bg-[#fafafa]"
        style={{ minWidth: 130, borderColor: '#ececec' }}
      >
        <span
          style={{
            width: 22, height: 22, borderRadius: 6,
            background: iconBg, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          {icon}
        </span>
        <span className="text-[13px] font-medium text-[#222]">{platform}</span>
      </span>
      <div className="relative flex-1 flex">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#aaa] text-[14px] pointer-events-none select-none">@</span>
        <input
          className="h-11 flex-1 border border-[#ececec] rounded-r-[10px] pl-7 pr-3.5 text-[14px] bg-white text-[#111] transition-[border-color,box-shadow] focus:outline-none focus:border-[#111] focus:shadow-[0_0_0_3px_rgba(17,17,17,0.06)] hover:border-[#dcdcdc]"
          value={value}
          onChange={e => onChange(e.target.value.replace(/^@+/, ''))}
          placeholder={placeholder}
        />
      </div>
    </div>
  )
}

interface PerkProps {
  color: string
  icon: React.ReactNode
  title: string
  desc: string
}

function Perk({ color, icon, title, desc }: PerkProps) {
  return (
    <div className="flex gap-3 items-start">
      <span
        className="w-9 h-9 rounded-[10px] flex items-center justify-center text-white flex-shrink-0"
        style={{ background: color }}
      >
        {icon}
      </span>
      <div>
        <div className="text-[13.5px] font-semibold text-[#111] mb-0.5">{title}</div>
        <div className="text-[12px] text-[#666] leading-[1.5]">{desc}</div>
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
  const [avatarImage, setAvatarImage] = useState<{ url: string; r2Key: string } | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<{ sellerName?: string; phone?: string; regions?: string }>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(searchParams.get('preview') === 'submitted')

  const becomeSeller = trpc.seller.becomeSeller.useMutation()
  const getPresignedUrl = trpc.upload.getPresignedUrl.useMutation()
  const deleteObjects = trpc.upload.deleteObjects.useMutation()

  if (!session?.profile) return null

  if (session.isSeller && searchParams.get('preview') !== 'submitted') {
    return (
      <div className="min-h-screen">
        <div className="mx-auto max-w-2xl px-4 py-8">
          <div className="border border-[#ececec] rounded-2xl p-6 bg-white">
            <h2 className="font-semibold text-[17px] mb-1" style={{ fontFamily: 'Rubik, "Noto Sans TC", sans-serif' }}>
              你已經是賣家了
            </h2>
            <p className="text-[14px] text-[#888] mb-4">前往賣家後台管理你的上架商品</p>
            <Link href="/dashboard">
              <button className="h-11 px-5 rounded-xl bg-[#111] text-white text-[14px] font-semibold flex items-center gap-2 hover:bg-[#222] transition-colors">
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

  return (
    <div className="min-h-screen bg-white">
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '48px 24px 100px' }}>

        {/* Breadcrumb */}
        <PageBreadcrumb items={[{ label: '成為賣家' }]} />

        {/* Outer grid: left (hero + form) | right (sticky sidebar) */}
        <div className={submitted ? 'max-w-xl mx-auto' : 'grid gap-12'} style={submitted ? {} : { gridTemplateColumns: '1fr 320px', alignItems: 'flex-start' }}>

          {/* LEFT: hero + form */}
          <div>
            {/* Hero */}
            <section className={`mb-9${submitted ? ' text-center' : ''}`}>
              <h1
                className="text-[38px] font-bold leading-[1.15] tracking-[-0.02em]"
                style={{ fontFamily: 'Rubik, "Noto Sans TC", sans-serif' }}
              >
                {submitted ? '恭喜成為' : '成為'}{' '}
                <span
                  style={{
                    background: `linear-gradient(95deg, ${KZ.teal}, ${KZ.purple} 35%, ${KZ.pink} 60%, ${KZ.orange})`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  Kozukase
                </span>{' '}
                賣家
              </h1>
              <p className="text-[15px] text-[#555] leading-[1.65] mt-3">
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
                    className="w-full h-11 border border-[#ececec] rounded-[10px] px-3.5 text-[14px] bg-white text-[#111] pr-14 transition-[border-color,box-shadow] focus:outline-none focus:border-[#111] focus:shadow-[0_0_0_3px_rgba(17,17,17,0.06)] hover:border-[#dcdcdc]"
                    placeholder="例：潮流代購、東京小幫手"
                    value={sellerName}
                    maxLength={NAME_MAX}
                    onChange={e => { setSellerName(e.target.value); if (errors.sellerName) setErrors(c => { const n = { ...c }; delete n.sellerName; return n }) }}
                    onKeyDown={e => { if (e.key === 'Enter') e.preventDefault() }}
                    aria-invalid={!!errors.sellerName}
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11.5px] text-[#aaa] tabular-nums pointer-events-none">{sellerName.length}/{NAME_MAX}</span>
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
                    className="w-full min-h-[120px] resize-y border border-[#ececec] rounded-[10px] px-3.5 py-3 pb-8 text-[14px] leading-relaxed bg-white text-[#111] transition-[border-color,box-shadow] focus:outline-none focus:border-[#111] focus:shadow-[0_0_0_3px_rgba(17,17,17,0.06)] hover:border-[#dcdcdc]"
                    placeholder="例：專營日本潮流選品，東京實體店面採購、附購買憑證。每週 2 班次穩定出貨，急件可加單，歡迎私訊討論。"
                    value={bio} maxLength={BIO_MAX} onChange={e => setBio(e.target.value)} rows={5}
                  />
                  <span className="absolute right-3.5 bottom-3 text-[11.5px] text-[#aaa] tabular-nums pointer-events-none">{bio.length}/{BIO_MAX}</span>
                </div>
              </FormSection>

              {/* Agreement + submit */}
              <div className="flex flex-col gap-[18px]">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <button type="button" onClick={() => setAgree(v => !v)}
                    className="w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center flex-shrink-0 mt-0.5 transition-[background,border-color]"
                    style={{ background: agree ? '#111' : '#fff', borderColor: agree ? '#111' : '#ccc', color: agree ? '#fff' : 'transparent' }}
                  >
                    {agree && <Check size={11} strokeWidth={2.5} />}
                  </button>
                  <span className="text-[13px] text-[#444] leading-[1.55] pt-0.5">
                    我已閱讀並同意{' '}
                    <span className="text-[#111] underline underline-offset-2 cursor-pointer">賣家服務條款</span>
                    {' '}與{' '}
                    <span className="text-[#111] underline underline-offset-2 cursor-pointer">代購規範</span>
                  </span>
                </label>
                <button
                  type="submit"
                  disabled={isPending || !agree || !filled.every(Boolean)}
                  className="h-[52px] px-7 rounded-xl bg-[#111] text-white text-[15px] font-semibold inline-flex items-center gap-2 transition-[background,transform] hover:bg-[#222] active:translate-y-px disabled:bg-[#ccc] disabled:cursor-not-allowed w-fit"
                >
                  {isPending ? '送出中…' : '送出申請'}
                </button>
              </div>
            </form>
          )}

          {/* 成為賣家後：社群連結 */}
          {submitted && (
            <div className="flex flex-col gap-7">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-semibold text-[#111]">Threads</span>
                  <SocialField platform="Threads" icon={<ThreadsIcon size={14} />} iconBg="#000" value={threads} onChange={setThreads} placeholder="yourname" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-semibold text-[#111]">Instagram</span>
                  <SocialField platform="Instagram" icon={<InstagramIcon size={14} />} iconBg="linear-gradient(135deg,#f58529,#dd2a7b 50%,#8134af)" value={insta} onChange={setInsta} placeholder="yourname" />
                </div>
              </div>
              <div className="flex justify-end">
                <Link href="/dashboard">
                  <button className="h-[52px] px-7 rounded-xl bg-[#111] text-white text-[15px] font-semibold inline-flex items-center gap-2 hover:bg-[#222] active:translate-y-px transition-[background,transform]">
                    先暫時跳過
                  </button>
                </Link>
              </div>
            </div>
          )}
          </div>{/* end left column */}

          {/* RIGHT: sticky sidebar */}
          {!submitted && <aside className="flex flex-col gap-4" style={{ position: 'sticky', top: 96, alignSelf: 'flex-start' }}>

            {/* Progress */}
            <div className="border border-[#ececec] rounded-[14px] p-5 bg-white">
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-[11px] font-medium text-[#888] uppercase tracking-[.05em]">完成度</span>
                <span className="text-[15px] font-bold" style={{ fontFamily: 'Rubik, sans-serif' }}>
                  {filledCount}<span className="text-[#bbb]"> / {filled.length}</span>
                </span>
              </div>
              <div className="h-1.5 bg-[#f0f0f0] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${KZ.teal}, ${KZ.purple}, ${KZ.pink}, ${KZ.orange})`,
                    transition: 'width .35s ease',
                  }}
                />
              </div>
              <div className="text-[11.5px] text-[#999] mt-2">填完全部欄位即可送出申請</div>
            </div>

            {/* Perks */}
            <div className="border border-[#ececec] rounded-[14px] p-5">
              <div className="text-[11px] font-medium text-[#888] uppercase tracking-[.05em] mb-3.5">賣家可以做什麼</div>
              <div className="flex flex-col gap-3.5">
                <Perk
                  color={KZ.teal}
                  icon={
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 8v13H3V8" /><path d="M1 3h22v5H1z" /><line x1="10" x2="14" y1="12" y2="12" />
                    </svg>
                  }
                  title="上架代購商品"
                  desc="發布商品圖、價格、出貨時間等等資訊"
                />
                <Perk
                  color={KZ.pink}
                  icon={
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
                    </svg>
                  }
                  title="發布連線代購"
                  desc="公告出國代購連線行程，集中收單。"
                />
                <Perk
                  color={KZ.orange}
                  icon={
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  }
                  title="獲得驗證徽章"
                  desc="完成審核後，賣家頁面顯示已驗證標記。"
                />
              </div>
            </div>

            {/* Help */}
            <div className="text-[11.5px] text-[#888] leading-relaxed px-1">
              有問題？查看{' '}
              <span className="text-[#111] underline underline-offset-2 cursor-pointer">賣家申請指南</span>
              {' '}或{' '}
              <span className="text-[#111] underline underline-offset-2 cursor-pointer">聯絡客服</span>。
            </div>
          </aside>}
        </div>
      </div>
    </div>
  )
}
