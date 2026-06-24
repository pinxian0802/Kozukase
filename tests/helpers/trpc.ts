import type { APIRequestContext } from '@playwright/test'

// Calls a tRPC mutation through an authenticated Playwright request context
// (uses the cookies of the page/context it came from). Matches the app's
// httpBatchLink + superjson wire format.
export async function trpcMutate<T = unknown>(
  request: APIRequestContext,
  procedure: string,
  input: unknown,
): Promise<T> {
  const res = await request.post(`/api/trpc/${procedure}?batch=1`, {
    headers: { 'Content-Type': 'application/json' },
    data: { '0': { json: input } },
  })
  const json = await res.json()
  const result = Array.isArray(json) ? json[0] : json
  if (result.error) {
    const err = result.error?.json ?? result.error
    throw new Error(err?.message ?? JSON.stringify(err))
  }
  const data = result.result?.data
  return (data?.json !== undefined ? data.json : data) as T
}

// Calls a tRPC query through an authenticated Playwright request context.
export async function trpcQuery<T = unknown>(
  request: APIRequestContext,
  procedure: string,
  input: unknown,
): Promise<T> {
  const encoded = encodeURIComponent(JSON.stringify({ '0': { json: input } }))
  const res = await request.get(`/api/trpc/${procedure}?batch=1&input=${encoded}`)
  const json = await res.json()
  const result = Array.isArray(json) ? json[0] : json
  if (result.error) {
    const err = result.error?.json ?? result.error
    throw new Error(err?.message ?? JSON.stringify(err))
  }
  const data = result.result?.data
  return (data?.json !== undefined ? data.json : data) as T
}
