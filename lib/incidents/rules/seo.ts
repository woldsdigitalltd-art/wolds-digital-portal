import 'server-only'
import { raiseIncident } from '../raise'
import type { SeoAuditResult } from '@/lib/integrations/seo-audit'

interface SeoRule {
  rule_key:    string
  title:       string
  description: string
  severity:    'info' | 'warning' | 'critical'
  failing:     (checks: SeoAuditResult['checks']) => boolean
}

const RULES: SeoRule[] = [
  {
    rule_key:    'seo:meta-title-fail',
    title:       'Meta title issue detected',
    description: 'The SEO audit flagged a problem with the page meta title length or format.',
    severity:    'warning',
    failing:     c => c.meta_content.title_length.status === 'fail',
  },
  {
    rule_key:    'seo:meta-description-fail',
    title:       'Meta description issue detected',
    description: 'The SEO audit flagged a missing or poorly formatted meta description.',
    severity:    'warning',
    failing:     c => c.meta_content.meta_description.status === 'fail',
  },
  {
    rule_key:    'seo:h1-fail',
    title:       'H1 heading issue detected',
    description: 'The SEO audit flagged a problem with the H1 heading count or structure.',
    severity:    'warning',
    failing:     c => c.meta_content.h1_count.status === 'fail',
  },
  {
    rule_key:    'seo:ssl-fail',
    title:       'SSL certificate issue detected',
    description: 'The SEO audit flagged an SSL or HTTPS problem that could harm search rankings and visitor trust.',
    severity:    'critical',
    failing:     c => c.technical.ssl.status === 'fail',
  },
  {
    rule_key:    'seo:sitemap-fail',
    title:       'Sitemap issue detected',
    description: 'The SEO audit could not find or parse a valid sitemap for this site.',
    severity:    'info',
    failing:     c => c.technical.sitemap.status === 'fail',
  },
  {
    rule_key:    'seo:structured-data-fail',
    title:       'Structured data issue detected',
    description: 'The SEO audit flagged missing or invalid structured data (schema markup).',
    severity:    'info',
    failing:     c => c.technical.structured_data.status === 'fail',
  },
]

export async function evaluateSeoRules(
  siteId:      string,
  auditResult: SeoAuditResult,
): Promise<void> {
  const checks = auditResult.checks
  if (!checks) return

  await Promise.all(
    RULES
      .filter(rule => rule.failing(checks))
      .map(rule =>
        raiseIncident({
          site_id:         siteId,
          integration_key: 'seo',
          rule_key:        rule.rule_key,
          title:           rule.title,
          description:     rule.description,
          severity:        rule.severity,
        }),
      ),
  )
}
