import 'server-only'
import { raiseAlert } from '../raise'
import { resolveAlert } from '../resolve'
import type { LiveUptime } from '@/lib/integrations/uptime'

export async function evaluateUptimeRules(
  siteId:      string,
  liveUptime:  LiveUptime,
): Promise<void> {
  const ruleKey = 'uptime:site-offline'

  if (liveUptime.status === 'down') {
    await raiseAlert({
      site_id:         siteId,
      integration_key: 'uptime',
      rule_key:        ruleKey,
      title:           'Site is offline',
      description:     'Better Stack is reporting your site as down.',
      severity:        'critical',
    })
  } else if (liveUptime.status === 'up') {
    // Auto-resolve if the site has come back online.
    await resolveAlert(siteId, ruleKey)
  }
}
