import type { EventType, Severity } from '@/types';
import type {
  EventClassification,
  LLMService,
  RawBulletin,
  SuggestedAlternative,
} from './LLMService';

/**
 * Deterministic, offline stand-in for a real LLM. It uses keyword heuristics
 * to mimic the shape of a classifier/suggester so the rest of the system can
 * be exercised without network or API keys. Swap for a real provider by
 * implementing LLMService against Claude (see INTEGRATION.md).
 */

const KEYWORDS: Array<{ re: RegExp; type: EventType; sev: Severity; days: number }> = [
  { re: /suez|red sea|cape of good hope|strait|canal/i, type: 'canal-strait-disruption', sev: 'critical', days: 60 },
  { re: /congest|berth|waiting time|backlog/i, type: 'port-congestion', sev: 'high', days: 21 },
  { re: /strike|union|industrial action|walkout/i, type: 'strike', sev: 'medium', days: 3 },
  { re: /typhoon|storm|hurricane|flood|weather/i, type: 'severe-weather', sev: 'high', days: 5 },
  { re: /blank sailing|capacity|withdraw|skip/i, type: 'carrier-capacity-withdrawal', sev: 'medium', days: 14 },
  { re: /closure|closed|shut/i, type: 'port-closure', sev: 'high', days: 7 },
  { re: /sanction|conflict|geopolit|tariff/i, type: 'geopolitical', sev: 'high', days: 45 },
];

const PORT_HINTS: Array<{ re: RegExp; codes: string[]; geo: string[] }> = [
  { re: /suez|red sea/i, codes: ['EGSUZ'], geo: ['Suez Canal', 'Red Sea'] },
  { re: /singapore/i, codes: ['SGSIN'], geo: ['Singapore'] },
  { re: /hamburg/i, codes: ['DEHAM'], geo: ['Hamburg'] },
  { re: /colombo/i, codes: ['LKCMB'], geo: ['Colombo'] },
  { re: /yantian|pearl river|hong kong/i, codes: ['CNYTN', 'HKHKG'], geo: ['Pearl River Delta'] },
  { re: /shanghai/i, codes: ['CNSHA'], geo: ['Shanghai'] },
  { re: /rotterdam/i, codes: ['NLRTM'], geo: ['Rotterdam'] },
];

export function createMockLLM(): LLMService {
  return {
    async classifyEvent(bulletin: RawBulletin): Promise<EventClassification> {
      const match = KEYWORDS.find((k) => k.re.test(bulletin.text)) ?? {
        type: 'geopolitical' as EventType,
        sev: 'low' as Severity,
        days: 7,
      };
      const ports = PORT_HINTS.filter((p) => p.re.test(bulletin.text));
      const codes = [...new Set(ports.flatMap((p) => p.codes))];
      const geo = [...new Set(ports.flatMap((p) => p.geo))];
      // Confidence proxy: stronger when we matched both a type and a geography.
      const confidence = Math.min(0.95, 0.4 + (codes.length ? 0.3 : 0) + 0.2);
      return {
        type: match.type,
        affectedGeographies: geo.length ? geo : ['Unknown'],
        affectedPortCodes: codes,
        severity: match.sev,
        estimatedDurationDays: match.days,
        confidence,
      };
    },

    async suggestAlternatives({ event, lane, containers }): Promise<SuggestedAlternative[]> {
      const urgent = containers.some((c) => c.kpi.daysRemaining <= lane.transitDays * 0.5);
      const out: SuggestedAlternative[] = [];

      if (lane.mot === 'sea') {
        out.push({
          title: 'Upgrade most at-risk boxes to air',
          description: `Air-freight the ${urgent ? 'launch-linked, OTD-critical' : 'highest-priority'} containers on ${lane.origin.name}→${lane.destination.name} to protect commercial dates.`,
          rationale:
            'Air bypasses the affected sea routing entirely; reserve for high-margin / launch-linked POs where the cost delta is justified by avoided markdowns.',
          leadTimeDeltaDays: -(lane.transitDays - 4),
          costDelta: 9000 * Math.max(1, containers.length),
          fromGeneralMarket: false,
        });
        out.push({
          title: 'Shift to sea-air via alternate hub',
          description: 'Break the journey at a non-affected transshipment hub and fly the final leg.',
          rationale: 'Balances cost and speed; feasible where belly/freighter capacity exists at the hub.',
          leadTimeDeltaDays: -(lane.transitDays - 12),
          costDelta: 4200 * Math.max(1, containers.length),
          fromGeneralMarket: true,
        });
      }

      out.push({
        title: `Switch carriers to avoid ${event.title}`,
        description:
          'Move bookings to a carrier whose network does not traverse the affected node, including options outside the current pool.',
        rationale:
          'Directly answers "can I switch carriers and avoid this entirely?" — viable only where the alternate routing genuinely bypasses the disruption and capacity is open.',
        leadTimeDeltaDays: 2,
        costDelta: 1500 * Math.max(1, containers.length),
        fromGeneralMarket: true,
      });

      return out;
    },
  };
}
