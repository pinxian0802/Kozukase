import { dbAdmin } from './db'
import { E2E_PREFIX } from './naming'

const LIKE = `${E2E_PREFIX}%`

// Delete every [E2E]-prefixed row. products has FKs without ON DELETE CASCADE
// (wishes, product_bookmarks), so dependent child rows are removed first.
export async function purgeE2EData(): Promise<void> {
  const db = dbAdmin()

  // [E2E] product ids.
  const { data: prods, error: pe } = await db.from('products').select('id').like('name', LIKE)
  if (pe) throw new Error(`purge: list products: ${pe.message}`)
  const productIds = (prods ?? []).map((p) => p.id as string)

  if (productIds.length > 0) {
    for (const child of ['wishes', 'product_bookmarks', 'listing_bookmarks']) {
      const { error } = await db.from(child).delete().in('product_id', productIds)
      // listing_bookmarks has no product_id; ignore that specific shape error.
      if (error && !/column .*product_id.* does not exist/i.test(error.message)) {
        throw new Error(`purge ${child}: ${error.message}`)
      }
    }
  }

  // Listings/connections first (FKs to products), then products.
  for (const { table, col } of [
    { table: 'listings', col: 'title' },
    { table: 'connections', col: 'title' },
    { table: 'products', col: 'name' },
  ]) {
    const { error } = await db.from(table).delete().like(col, LIKE)
    if (error) throw new Error(`purge ${table}: ${error.message}`)
  }
}

// Restore global state mutated by tests (e.g. a suspended e2e seller).
export async function restoreGlobalState(): Promise<void> {
  await dbAdmin()
    .from('sellers')
    .update({ is_suspended: false, suspended_at: null })
    .like('name', 'E2E%')
    .eq('is_suspended', true)
}
