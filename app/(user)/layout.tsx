import { Header } from '@/components/layout/header'
import { ConditionalFooter } from '@/components/layout/conditional-footer'

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">{children}</main>
      <ConditionalFooter />
    </>
  )
}
