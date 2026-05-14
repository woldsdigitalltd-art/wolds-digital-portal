import 'server-only'
import { raiseIncident } from '../raise'
import type { BrokenLinksResult } from '@/lib/integrations/broken-links'

export async function evaluateBrokenLinksRules(
  siteId: string,
  result: BrokenLinksResult,
): Promise<void> {
  const { broken } = result

  if (broken <= 0) return

  const raises: Promise<void>[] = []

  raises.push(
    raiseIncident({
      site_id:         siteId,
      integration_key: 'broken-links',
      rule_key:        'broken-links:links-found',
      title:           'Broken links detected',
      description:     `The broken link scan found ${broken} broken link${broken === 1 ? '' : 's'} on your site.`,
      severity:        'warning',
    }),
  )

  if (broken >= 10) {
    raises.push(
      raiseIncident({
        site_id:         siteId,
        integration_key: 'broken-links',
        rule_key:        'broken-links:high-count',
        title:           'High number of broken links detected',
        description:     `The broken link scan found ${broken} broken links — this is above the critical threshold of 10 and may significantly harm user experience and SEO.`,
        severity:        'critical',
      }),
    )
  }

  await Promise.all(raises)
}
