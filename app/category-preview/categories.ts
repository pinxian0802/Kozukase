import {
  ShoppingBag, Sparkles, Candy, Smartphone, Home, Gamepad2, MoreHorizontal,
  HeartPulse, Dumbbell, BookOpen, PawPrint, Landmark, Car, Baby, Gem, Star,
  type LucideIcon,
} from 'lucide-react'

export type Category = {
  key: string
  label: string
  icon: LucideIcon
  /** soft background + foreground for the color-coded variant */
  tint: { bg: string; fg: string }
}

export const categories: Category[] = [
  { key: 'fashion', label: '時尚穿搭', icon: ShoppingBag, tint: { bg: 'oklch(0.95 0.04 20)', fg: 'oklch(0.55 0.16 20)' } },
  { key: 'beauty', label: '美妝保養', icon: Sparkles, tint: { bg: 'oklch(0.95 0.04 340)', fg: 'oklch(0.55 0.18 340)' } },
  { key: 'health', label: '保健品', icon: HeartPulse, tint: { bg: 'oklch(0.95 0.04 150)', fg: 'oklch(0.52 0.15 150)' } },
  { key: 'food', label: '食品零食', icon: Candy, tint: { bg: 'oklch(0.96 0.05 70)', fg: 'oklch(0.58 0.15 60)' } },
  { key: 'electronics', label: '3C 電器', icon: Smartphone, tint: { bg: 'oklch(0.95 0.04 250)', fg: 'oklch(0.55 0.16 255)' } },
  { key: 'lifestyle', label: '生活雜貨', icon: Home, tint: { bg: 'oklch(0.95 0.04 195)', fg: 'oklch(0.52 0.13 195)' } },
  { key: 'sports', label: '運動戶外', icon: Dumbbell, tint: { bg: 'oklch(0.95 0.05 145)', fg: 'oklch(0.52 0.16 145)' } },
  { key: 'toys', label: '公仔玩具', icon: Gamepad2, tint: { bg: 'oklch(0.95 0.04 290)', fg: 'oklch(0.55 0.18 290)' } },
  { key: 'books', label: '書籍文具', icon: BookOpen, tint: { bg: 'oklch(0.95 0.04 230)', fg: 'oklch(0.52 0.14 230)' } },
  { key: 'pets', label: '寵物用品', icon: PawPrint, tint: { bg: 'oklch(0.96 0.05 50)', fg: 'oklch(0.55 0.15 45)' } },
  { key: 'culture', label: '文化紀念品', icon: Landmark, tint: { bg: 'oklch(0.95 0.04 170)', fg: 'oklch(0.5 0.13 170)' } },
  { key: 'automotive', label: '汽機車用品', icon: Car, tint: { bg: 'oklch(0.94 0.03 265)', fg: 'oklch(0.5 0.12 265)' } },
  { key: 'baby', label: '母嬰用品', icon: Baby, tint: { bg: 'oklch(0.96 0.04 25)', fg: 'oklch(0.6 0.13 25)' } },
  { key: 'jewelry', label: '珠寶首飾', icon: Gem, tint: { bg: 'oklch(0.95 0.04 310)', fg: 'oklch(0.55 0.16 310)' } },
  { key: 'idol', label: '明星偶像', icon: Star, tint: { bg: 'oklch(0.96 0.05 85)', fg: 'oklch(0.58 0.14 80)' } },
  { key: 'other', label: '其他', icon: MoreHorizontal, tint: { bg: 'oklch(0.95 0.01 240)', fg: 'oklch(0.5 0.02 240)' } },
]
