import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from './site'

// 以空白串接非空字串（自動去除 null/undefined/空白），用於「品牌 商品名 型號」。
export function joinParts(parts: (string | null | undefined)[]): string {
  return parts.map((p) => p?.trim()).filter(Boolean).join(' ')
}

// 商品標題：品牌 商品名稱 型號 - Kozukase（缺欄位自動省略）
export function buildProductTitle(p: {
  name: string
  brand?: string | null
  model?: string | null
}): string {
  return `${joinParts([p.brand, p.name, p.model])} - ${SITE_NAME}`
}

export function buildOrganizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    description: SITE_DESCRIPTION,
  }
}

export function buildWebSiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

export function buildBreadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

// 商品（比價頁）：Product + AggregateOffer。評價不放在商品（評價屬賣家）。
export function buildProductJsonLd(p: {
  id: string
  name: string
  brand?: string | null
  category?: string | null
  imageUrl?: string | null
  offers: { lowPrice: number; highPrice: number; offerCount: number } | null
}) {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    url: `${SITE_URL}/products/${p.id}`,
  }
  if (p.brand) data.brand = { '@type': 'Brand', name: p.brand }
  if (p.category) data.category = p.category
  if (p.imageUrl) data.image = p.imageUrl
  if (p.offers && p.offers.offerCount > 0) {
    data.offers = {
      '@type': 'AggregateOffer',
      priceCurrency: 'TWD',
      lowPrice: p.offers.lowPrice,
      highPrice: p.offers.highPrice,
      offerCount: p.offers.offerCount,
    }
  }
  return data
}

// 賣家：Organization + AggregateRating（僅在有評價時）。
export function buildSellerJsonLd(s: {
  id: string
  name: string
  avatarUrl?: string | null
  igHandle?: string | null
  threadsHandle?: string | null
  avgRating?: number | null
  reviewCount: number
}) {
  const sameAs: string[] = []
  if (s.igHandle) sameAs.push(`https://www.instagram.com/${s.igHandle}`)
  if (s.threadsHandle) sameAs.push(`https://www.threads.net/@${s.threadsHandle}`)

  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: s.name,
    url: `${SITE_URL}/sellers/${s.id}`,
  }
  if (s.avatarUrl) data.image = s.avatarUrl
  if (sameAs.length) data.sameAs = sameAs
  if (s.reviewCount > 0 && s.avgRating != null) {
    data.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: s.avgRating,
      reviewCount: s.reviewCount,
    }
  }
  return data
}
