import type {
  Alternative,
  Carrier,
  ContainerImpact,
  Dataset,
  Event,
  Lane,
  ModeOfTransport,
} from '@/types';
import type { LLMService } from './llm/LLMService';
import { laneAffectedByEvent } from './impactEngine';

/**
 * Alternatives / corrective-actions engine. Produces ranked options, each with
 * estimated LT change, cost delta and capacity feasibility. Combines
 * deterministic routing/carrier logic with LLM-suggested options, then ranks.
 *
 * "Can I switch carriers and avoid this entirely?" is answered as a
 * first-class field on the result (see `canSwitchCarrierToAvoid`).
 */

export interface AlternativesResult {
  laneId: string;
  options: Alternative[];
  /** Direct answer to "can I switch carriers and avoid this entirely?" */
  canSwitchCarrierToAvoid: boolean;
  switchCarrierOption?: Alternative;
}

const MOT_SPEED: Record<ModeOfTransport, number> = { air: 4, 'sea-air': 12, rail: 20, sea: 32 };

/** Relative cost multiplier per mode (sea = 1). */
const MOT_COST: Record<ModeOfTransport, number> = { sea: 1, rail: 1.3, 'sea-air': 3.5, air: 8 };

/** Capacity is "feasible" above this threshold. */
const CAPACITY_OK = 0.35;

function baseValue(impacts: ContainerImpact[]): number {
  return impacts.reduce((s, c) => s + c.valueAtRisk, 0);
}

/**
 * Does an alternate routing on a given mode avoid the event? A carrier/mode
 * avoids the disruption if a non-affected lane exists between the same
 * origin/destination on that mode.
 */
function existsAvoidingLane(dataset: Dataset, lane: Lane, mot: ModeOfTransport, event: Event): boolean {
  return dataset.lanes.some(
    (l) =>
      l.mot === mot &&
      l.origin.code === lane.origin.code &&
      l.destination.code === lane.destination.code &&
      !laneAffectedByEvent(l, event),
  );
}

function score(alt: Omit<Alternative, 'id' | 'score'>): number {
  // Reward speed and disruption-avoidance, penalise cost and infeasibility.
  const speed = -alt.leadTimeDeltaDays; // faster (more negative delta) ⇒ higher
  const costPenalty = alt.costDelta / 10000;
  const avoidBonus = alt.avoidsDisruption ? 25 : 0;
  const feasiblePenalty = alt.capacityFeasible ? 0 : 30;
  return Math.round(speed + avoidBonus - costPenalty - feasiblePenalty);
}

function carrierOption(
  carrier: Carrier,
  lane: Lane,
  impacts: ContainerImpact[],
  avoids: boolean,
): Omit<Alternative, 'id' | 'score'> {
  const value = baseValue(impacts);
  return {
    kind: 'alternative-carrier',
    title: `Switch to ${carrier.name}${carrier.inPool ? '' : ' (outside pool)'}`,
    description: `Re-book ${impacts.length} container(s) with ${carrier.name} on ${lane.origin.name}→${lane.destination.name}.`,
    leadTimeDeltaDays: avoids ? -2 : 1,
    costDelta: Math.round(value * 0.02 * (carrier.inPool ? 1 : 1.4)),
    capacityFeasible: carrier.capacityLevel >= CAPACITY_OK,
    carrierId: carrier.id,
    fromGeneralMarket: !carrier.inPool,
    avoidsDisruption: avoids && carrier.capacityLevel >= CAPACITY_OK,
    rationale: avoids
      ? `${carrier.name}'s routing bypasses the affected node; capacity ${(carrier.capacityLevel * 100).toFixed(0)}%.`
      : `${carrier.name} still traverses the affected node, so this re-books but does not avoid the disruption.`,
  };
}

function motOption(
  mot: ModeOfTransport,
  lane: Lane,
  impacts: ContainerImpact[],
  avoids: boolean,
): Omit<Alternative, 'id' | 'score'> {
  const value = baseValue(impacts);
  const ltDelta = MOT_SPEED[mot] - lane.transitDays;
  const costDelta = Math.round(value * 0.01 * (MOT_COST[mot] - MOT_COST[lane.mot]));
  return {
    kind: mot === lane.mot ? 'reroute' : 'alternative-mot',
    title: mot === lane.mot ? 'Re-route on same mode' : `Switch mode to ${mot}`,
    description: `Move ${impacts.length} container(s) via ${mot} (${MOT_SPEED[mot]}d nominal transit).`,
    leadTimeDeltaDays: ltDelta,
    costDelta,
    capacityFeasible: true,
    fromGeneralMarket: false,
    avoidsDisruption: avoids,
    rationale: avoids
      ? `A ${mot} routing avoids the affected node entirely.`
      : `Faster mode reduces exposure window but still touches the affected node.`,
  };
}

export async function buildAlternatives(
  dataset: Dataset,
  event: Event,
  lane: Lane,
  impacts: ContainerImpact[],
  llm: LLMService,
  carrierFinder: (mot: ModeOfTransport, includeOutsidePool: boolean) => Carrier[],
): Promise<AlternativesResult> {
  const raw: Array<Omit<Alternative, 'id' | 'score'>> = [];

  // 1. Skip port call (only meaningful for sea with a transshipment).
  if (lane.mot === 'sea' && lane.transshipment) {
    raw.push({
      kind: 'skip-port-call',
      title: `Skip ${lane.transshipment.name} call`,
      description: `Omit the congested/affected ${lane.transshipment.name} transshipment and route direct.`,
      leadTimeDeltaDays: -3,
      costDelta: Math.round(baseValue(impacts) * 0.005),
      capacityFeasible: true,
      fromGeneralMarket: false,
      avoidsDisruption: lane.transshipment.code === event.affectedPortCodes[0],
      rationale: 'Dropping the affected call removes the exposure if it is the disrupted node.',
    });
  }

  // 2. Alternative modes of transport.
  const altModes: ModeOfTransport[] = (['air', 'sea-air', 'rail', 'sea'] as ModeOfTransport[]).filter(
    (m) => m !== lane.mot,
  );
  for (const mot of altModes) {
    raw.push(motOption(mot, lane, impacts, existsAvoidingLane(dataset, lane, mot, event)));
  }

  // 3. Alternative carriers (in-pool + outside-pool), capacity-checked.
  const candidates = carrierFinder(lane.mot, true).filter((c) => c.id !== impacts[0]?.container.carrierId);
  const avoidsOnMode = existsAvoidingLane(dataset, lane, lane.mot, event);
  for (const c of candidates) {
    raw.push(carrierOption(c, lane, impacts, avoidsOnMode));
  }

  // 4. LLM-suggested options (general-market + scope-internal).
  const suggested = await llm.suggestAlternatives({
    event,
    lane,
    containers: impacts.map((i) => i.container),
  });
  for (const s of suggested) {
    raw.push({
      kind: 'reroute',
      title: s.title,
      description: s.description,
      leadTimeDeltaDays: s.leadTimeDeltaDays,
      costDelta: s.costDelta,
      capacityFeasible: true,
      fromGeneralMarket: s.fromGeneralMarket,
      avoidsDisruption: /switch carrier|avoid/i.test(s.title),
      rationale: s.rationale,
    });
  }

  const options: Alternative[] = raw
    .map((o, i) => ({ ...o, id: `${lane.id}-alt-${i + 1}`, score: score(o) }))
    .sort((a, b) => b.score - a.score);

  // First-class "can I switch carriers and avoid this entirely?"
  const switchCarrierOption = options.find(
    (o) => o.kind === 'alternative-carrier' && o.avoidsDisruption && o.capacityFeasible,
  );

  return {
    laneId: lane.id,
    options,
    canSwitchCarrierToAvoid: !!switchCarrierOption,
    switchCarrierOption,
  };
}
