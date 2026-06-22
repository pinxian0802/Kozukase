import Link from 'next/link'
import Image from 'next/image'
import { SITE_SOCIAL_LINKS } from '@/lib/seo/site'

export function Footer() {
  return (
    <footer className="mt-auto hidden border-t bg-background md:block">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
          <Link href="/" className="font-heading text-base font-bold text-foreground tracking-tight">
            Kozukase
          </Link>
          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/terms" className="hover:text-foreground transition-colors">使用者條款</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">隱私權政策</Link>
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
                  <Image src={s.icon} alt={s.name} width={22} height={22} className="rounded-[5px]" />
                </a>
              ))}
            </div>
          </nav>
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Kozukase</p>
        </div>
      </div>
    </footer>
  )
}
