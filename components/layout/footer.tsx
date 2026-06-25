import Link from 'next/link'
import Image from 'next/image'
import { SITE_SOCIAL_LINKS } from '@/lib/seo/site'

export function Footer() {
  return (
    <footer className="mt-auto border-t bg-background">
      <div className="mx-auto max-w-6xl px-4 py-3.5 md:py-5">
        <div className="flex flex-col items-center gap-3 md:flex-row md:justify-between md:gap-6">
          <Link href="/" className="shrink-0" aria-label="Kozukase 首頁">
            <Image src="/logo-navbar.png" alt="Kozukase" width={502} height={177} className="h-6 w-auto" />
          </Link>
          <div className="flex flex-row items-center gap-4 sm:gap-5">
            <nav className="flex items-center gap-5 text-sm text-muted-foreground">
              <Link href="/terms" className="hover:text-foreground transition-colors">使用者條款</Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors">隱私權政策</Link>
            </nav>
            <div className="flex items-center gap-3">
              {SITE_SOCIAL_LINKS.map((s) => (
                <a
                  key={s.name}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.name}
                  className="opacity-80 transition-opacity hover:opacity-100"
                >
                  <Image src={s.icon} alt={s.name} width={20} height={20} className="rounded-[5px]" />
                </a>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground md:text-sm">© {new Date().getFullYear()} Kozukase</p>
        </div>
      </div>
    </footer>
  )
}
