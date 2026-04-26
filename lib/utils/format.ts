export function formatPrice(price: number | null, isPriceOnRequest: boolean): string {
  if (isPriceOnRequest || price === null) return '私訊報價'
  return `NT$ ${price.toLocaleString()}`
}

export function formatShippingDays(days: number): string {
  return `${days} 天出貨`
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatRelativeTime(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '剛剛'
  if (minutes < 60) return `${minutes} 分鐘前`
  if (hours < 24) return `${hours} 小時前`
  if (days < 30) return `${days} 天前`
  return formatDate(dateString)
}

export const PRODUCT_CATEGORY_LABELS: Record<string, string> = {
  fashion: '時尚穿搭',
  beauty: '美妝保養',
  health: '保健品',
  food: '食品零食',
  electronics: '3C 電器',
  lifestyle: '生活雜貨',
  sports: '運動戶外',
  toys: '公仔玩具',
  books: '書籍文具',
  pets: '寵物用品',
  culture: '文化紀念品',
  automotive: '汽機車用品',
  baby: '母嬰用品',
  jewelry: '珠寶首飾',
  other: '其他',
}

export const SPEC_TYPE_OPTIONS = [
  '顏色', '尺寸', '口味', '容量', '材質', '款式', '重量',
] as const
