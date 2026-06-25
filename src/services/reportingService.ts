import type { EventImpactAssessment } from '@/types';
import { formatCurrency } from '@/utils/format';

/**
 * Automated reporting (§3.6). Produces a one-click textual report per event /
 * impacted scope, suitable for export or distribution to the functions that
 * need to be informed.
 */
export function buildEventReport(a: EventImpactAssessment): string {
  const e = a.event;
  const lines: string[] = [];
  lines.push(`# Disruption Report — ${e.title}`);
  lines.push('');
  lines.push(`**Type:** ${e.type}   **Severity:** ${e.severity}   **Confidence:** ${(e.confidence * 100).toFixed(0)}%`);
  lines.push(`**Detected:** ${new Date(e.detectedAt).toLocaleDateString()}   **Est. duration:** ${e.estimatedDurationDays} days${e.predicted ? '   _(predicted)_' : ''}`);
  lines.push(`**Affected:** ${e.affectedGeographies.join(', ')}`);
  lines.push('');
  lines.push(e.description);
  lines.push('');
  lines.push('## Impact summary');
  lines.push(`- In-use lanes impacted: **${a.inUseLaneIds.length}** of ${a.impactedLanes.length} touched`);
  lines.push(`- Containers at risk: **${a.totals.containers}** (${a.totals.shortTermContainers} short-term / ${a.totals.longTermContainers} long-term)`);
  lines.push(`- Purchase orders at risk: **${a.totals.purchaseOrders}**`);
  lines.push(`- Value at risk: **${formatCurrency(a.totals.valueAtRisk)}**   Quantity: **${a.totals.quantityAtRisk.toLocaleString()}** units`);
  lines.push(`- Avg added lead time: **${a.totals.degree.leadTimeDays} days**   Added cost: **${formatCurrency(a.totals.degree.cost)}**   Avg service risk: **${(a.totals.degree.service * 100).toFixed(0)}%**`);
  lines.push('');
  if (a.ripples.length) {
    lines.push('## Ripple effects (indirect)');
    for (const r of a.ripples.slice(0, 10)) {
      lines.push(`- [${r.severity}] ${r.description}`);
    }
    if (a.ripples.length > 10) lines.push(`- …and ${a.ripples.length - 10} more`);
    lines.push('');
  }
  lines.push('## Functions to involve');
  lines.push(a.functionsToInvolve.map((f) => `- ${f}`).join('\n'));
  lines.push('');
  lines.push('## Most at-risk containers');
  const top = [...a.containerImpacts]
    .sort((x, y) => y.degree.service - x.degree.service || y.valueAtRisk - x.valueAtRisk)
    .slice(0, 8);
  for (const ci of top) {
    lines.push(
      `- ${ci.container.containerNo} (${ci.lane.origin.name}→${ci.lane.destination.name}): ` +
        `${ci.purchaseOrders.length} PO(s), ${formatCurrency(ci.valueAtRisk)}, ` +
        `OTD ${ci.container.kpi.daysRemaining}d, +${ci.degree.leadTimeDays}d, service risk ${(ci.degree.service * 100).toFixed(0)}%`,
    );
  }
  lines.push('');
  lines.push(`_Generated ${new Date().toLocaleString()} — Lane Disruption Intelligence_`);
  return lines.join('\n');
}
