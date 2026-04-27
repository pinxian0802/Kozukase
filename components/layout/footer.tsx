import Link from 'next/link'

export function Footer() {
  return (
    <footer className="mt-auto border-t bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
          <Link href="/" className="font-heading text-base font-bold text-foreground tracking-tight">
            Kozukase
          </Link>
          <nav className="flex gap-6 text-sm text-muted-foreground">
            <Link href="/about" className="hover:text-foreground transition-colors">關於我們</Link>
            <Link href="/help" className="hover:text-foreground transition-colors">使用說明</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">隱私權政策</Link>
          </nav>
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Kozukase</p>
        </div>
      </div>
    </footer>
  )
}
