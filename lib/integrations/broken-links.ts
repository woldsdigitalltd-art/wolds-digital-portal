/**
 * Shared Broken Links (Geekflare) audit types + pure helpers.
 *
 * Lives outside `server-only` so the admin modal (client component)
 * and the portal broken-links page (server component) can both render
 * the report. The provider call itself lives in `@/lib/geekflare`.
 */

export interface BrokenLink {
  link:        string
  status_code: number
  error:       string
  found_on:    string
}

export interface BrokenLinksResult {
  url:          string
  total_links:  number
  broken:       number
  warnings:     number
  broken_links: BrokenLink[]
  /** ISO timestamp stamped server-side before persistence. */
  audited_at: string
}
