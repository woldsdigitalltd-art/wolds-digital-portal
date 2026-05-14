import 'server-only'
import { raiseIncident } from '../raise'
import type { PageSpeedResult } from '@/lib/integrations/page-speed'

export async function evaluatePageSpeedRules(
  siteId: string,
  result: PageSpeedResult,
): Promise<void> {
  const { scores, core_web_vitals } = result
  const perf = scores.performance

  const raises: Promise<void>[] = []

  if (perf < 25) {
    raises.push(
      raiseIncident({
        site_id:         siteId,
        integration_key: 'page-speed',
        rule_key:        'page-speed:performance-critical',
        title:           'Critical performance score',
        description:     `Lighthouse performance score is ${perf}/100, which is critically low. Pages at this level typically have very poor load times and will significantly impact user retention and SEO.`,
        severity:        'critical',
      }),
    )
  } else if (perf < 50) {
    raises.push(
      raiseIncident({
        site_id:         siteId,
        integration_key: 'page-speed',
        rule_key:        'page-speed:performance-poor',
        title:           'Poor performance score',
        description:     `Lighthouse performance score is ${perf}/100. Scores below 50 indicate meaningful load-time problems that affect user experience and search rankings.`,
        severity:        'warning',
      }),
    )
  }

  if (core_web_vitals.lcp?.status === 'fail') {
    raises.push(
      raiseIncident({
        site_id:         siteId,
        integration_key: 'page-speed',
        rule_key:        'page-speed:lcp-fail',
        title:           'Largest Contentful Paint is failing',
        description:     `LCP is ${core_web_vitals.lcp.value}${core_web_vitals.lcp.unit}, which does not meet the "Good" threshold. This is a Core Web Vital that directly affects Google search ranking.`,
        severity:        'warning',
      }),
    )
  }

  if (core_web_vitals.cls?.status === 'fail') {
    raises.push(
      raiseIncident({
        site_id:         siteId,
        integration_key: 'page-speed',
        rule_key:        'page-speed:cls-fail',
        title:           'Cumulative Layout Shift is failing',
        description:     `CLS score is ${core_web_vitals.cls.value.toFixed(3)}, which does not meet the "Good" threshold. Layout instability can frustrate users and is a Core Web Vital tracked by Google.`,
        severity:        'warning',
      }),
    )
  }

  await Promise.all(raises)
}
