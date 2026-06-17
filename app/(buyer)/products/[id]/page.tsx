import type { Metadata } from 'next'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import ProductPageClient from './page-client'
import { JsonLd } from '@/lib/seo/jsonld'
import {
  buildProductTitle,
  buildProductJsonLd,
  buildBreadcrumbJsonLd,
} from '@/lib/seo/builders'
import { SITE_URL, SITE_NAME } from '@/lib/seo/site'
import { PRODUCT_CATEGORY_LABELS } from '@/lib/utils/format'

type ProductSeo = {
  name: string
  model_number: string | null
  category: string
  catalog_image_id: string | null
  brand: { name: string } | null
}

async function getProductSeo(id: string) {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('products')
    .select('name, model_number, category, catalog_image_id, brand:brands(name)')
    .eq('id', id)
    .eq('is_removed', false)
    .single()
  if (!data) return null
  const p = data as unknown as ProductSeo

  let imageUrl: string | null = null
  if (p.catalog_image_id) {
    const { data: img } = await supabase
      .from('product_images')
      .select('url')
      .eq('id', p.catalog_image_id)
      .single()
    imageUrl = img?.url ?? null
  }

  const { data: listings } = await supabase
    .from('listings')
    .select('price')
    .eq('product_id', id)
    .eq('status', 'active')
    .eq('is_price_on_request', false)
    .not('price', 'is', null)

  const prices = (listings ?? []).map((l) => Number(l.price)).filter((n) => !Number.isNaN(n))
  const offers =
    prices.length > 0
      ? { lowPrice: Math.min(...prices), highPrice: Math.max(...prices), offerCount: prices.length }
      : null

  return {
    name: p.name,
    brand: p.brand?.name ?? null,
    model: p.model_number,
    category: p.category,
    imageUrl,
    offers,
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params
  const p = await getProductSeo(id)
  if (!p) return { title: `${SITE_NAME} - 代購比價平台` }

  const title = buildProductTitle(p)
  const description = `在 ${SITE_NAME} 比較多位代購的 ${p.name} 價格、運費與現貨狀態。`
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/products/${id}` },
    openGraph: {
      title,
      description,
      images: p.imageUrl ? [{ url: p.imageUrl }] : undefined,
    },
  }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const p = await getProductSeo(id)

  return (
    <>
      {p && (
        <JsonLd
          data={[
            buildProductJsonLd({ id, ...p }),
            buildBreadcrumbJsonLd([
              { name: '首頁', url: SITE_URL },
              {
                name: PRODUCT_CATEGORY_LABELS[p.category as keyof typeof PRODUCT_CATEGORY_LABELS] ?? '商品',
                url: `${SITE_URL}/search?category=${p.category}`,
              },
              { name: p.name, url: `${SITE_URL}/products/${id}` },
            ]),
          ]}
        />
      )}
      <ProductPageClient params={params} />
    </>
  )
}
