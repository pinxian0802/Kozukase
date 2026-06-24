'use client'

import Image from 'next/image'
import { Loader2 } from 'lucide-react'
import { FormFieldError } from '@/components/shared/form-field-error'
import { Button } from '@/components/ui/button'
import { useIgVerification } from '@/lib/hooks/use-ig-verification'

type Props = {
  vm: ReturnType<typeof useIgVerification>
  adminHandle: string
}

// IG 驗證卡片：承載 entering_username ~ success 各步驟 UI。idle 由父層決定顯示。
export function IgVerificationCard({ vm, adminHandle }: Props) {
  const {
    state, setState, usernameInput, setUsernameInput, inputError, setInputError,
    countdown, start, confirmSent, cancel,
  } = vm

  return (
    <>
      {state.step === 'entering_username' && (
        <div className="flex flex-col gap-7">
          <div className="flex flex-col items-center gap-3.5 text-center">
            <div className="w-14 h-14 rounded-2xl overflow-hidden">
              <Image src="/images/instagram.png" alt="Instagram" width={56} height={56} />
            </div>
            <div>
              <p className="font-semibold text-[15px] text-text-strong">驗證 Instagram</p>
              <p className="text-[13px] text-text-muted mt-1 leading-relaxed">輸入你的帳號名稱</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <input
              className="w-full h-11 px-3.5 rounded-xl border border-border-soft bg-white text-[14px] text-text-strong placeholder:text-text-faint focus:outline-none focus:border-text-strong focus:shadow-[0_0_0_3px_rgba(17,17,17,0.06)] transition-[border-color,box-shadow]"
              placeholder="帳號名稱"
              value={usernameInput}
              onChange={e => { setUsernameInput(e.target.value); setInputError('') }}
              onKeyDown={e => { if (e.key === 'Enter') void start() }}
              autoFocus
            />
            <FormFieldError message={inputError} />
          </div>
          <div className="flex flex-col gap-2">
            <Button variant="cta-outline" className="w-full" onClick={() => void start()}>
              取得驗證碼
            </Button>
            <Button variant="ghost" className="w-full" onClick={cancel}>
              取消
            </Button>
          </div>
        </div>
      )}

      {state.step === 'loading_code' && (
        <div className="flex flex-col items-center gap-5 py-10 text-center">
          <div className="flex items-center gap-2 text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-[13px]">正在產生驗證碼⋯</span>
          </div>
        </div>
      )}

      {state.step === 'waiting_send' && (
        <div className="flex flex-col gap-6">
          <div className="text-center space-y-1">
            <p className="font-semibold text-[15px] text-text-strong">傳送驗證碼</p>
            <p className="text-[13px] text-text-muted leading-relaxed">
              用 Instagram 私訊以下數字給{' '}
              <a href={`https://www.instagram.com/${adminHandle}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-text-strong hover:underline">
                @{adminHandle}
              </a>
            </p>
            <p className="text-[13px] text-text-muted leading-relaxed">傳送後請點擊『<span className="text-text-strong">我已傳送</span>』按鈕</p>
          </div>
          <div className="flex justify-center gap-2">
            {state.code.toString().split('').map((digit, i) => (
              <div key={i} className="flex items-center justify-center rounded-xl border-2 border-border-soft bg-surface-muted text-[22px] font-mono font-bold text-text-strong shadow-sm" style={{ width: 40, height: 52 }}>
                {digit}
              </div>
            ))}
          </div>
          <span className="text-[12px] font-mono text-text-faint tabular-nums text-center">剩餘時間 {countdown}</span>
          <div className="flex flex-col gap-2">
            <Button variant="cta-outline" className="w-full" onClick={() => void confirmSent(state.id)}>
              我已傳送
            </Button>
            <Button variant="ghost" className="w-full" onClick={cancel}>
              取消
            </Button>
          </div>
        </div>
      )}

      {state.step === 'reviewing' && (
        <div className="flex flex-col items-center gap-6 py-6 text-center">
          <div className="w-[72px] h-[72px] rounded-2xl overflow-hidden">
            <Image src="/images/instagram.png" alt="Instagram" width={72} height={72} />
          </div>
          <div className="space-y-1.5">
            <p className="font-semibold text-[16px] text-text-strong">審核中</p>
            <p className="text-[13px] text-text-muted leading-relaxed">我們已收到你的驗證,管理員審核通過後會以通知告知你。</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Button variant="cta-outline" className="px-10" onClick={() => setState({ step: 'idle' })}>
              返回
            </Button>
            <Button variant="ghost" className="px-10" onClick={cancel}>
              取消
            </Button>
          </div>
        </div>
      )}

      {state.step === 'rejected' && (
        <div className="flex flex-col items-center gap-6 py-6 text-center">
          <div className="relative">
            <div className="w-[72px] h-[72px] rounded-2xl overflow-hidden">
              <Image src="/images/instagram.png" alt="Instagram" width={72} height={72} />
            </div>
            <div className="absolute -bottom-1 -right-1 w-[22px] h-[22px] rounded-full bg-red-500 border-2 border-white flex items-center justify-center">
              <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3.5} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="font-semibold text-[16px] text-text-strong">驗證未通過</p>
            <p className="text-[13px] text-text-muted">{state.reason || '管理員未通過這次驗證,請確認已把驗證碼私訊給正確帳號後重試'}</p>
          </div>
          <Button variant="cta-outline" className="px-10" onClick={() => { setState({ step: 'entering_username' }); setUsernameInput('') }}>
            重新驗證
          </Button>
        </div>
      )}

      {state.step === 'success' && (
        <div className="flex flex-col items-center gap-6 py-6 text-center">
          <div className="relative">
            <div className="w-[72px] h-[72px] rounded-2xl overflow-hidden">
              <Image src="/images/instagram.png" alt="Instagram" width={72} height={72} />
            </div>
            <div className="absolute -bottom-1 -right-1 w-[22px] h-[22px] rounded-full bg-green-500 border-2 border-white flex items-center justify-center">
              <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="font-semibold text-[16px] text-text-strong">驗證完成</p>
            <p className="text-[13px] text-text-muted">@{usernameInput} 已成功連結至賣家頁面</p>
          </div>
          <Button variant="cta-outline" className="px-10" onClick={() => setState({ step: 'idle' })}>
            完成
          </Button>
        </div>
      )}
    </>
  )
}
