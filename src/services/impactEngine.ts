import type {
  BusinessFunction,
  Container,
  ContainerImpact,
  Dataset,
  Event,
  EventImpactAssessment,
  ImpactDegree,
  Lane,
  PurchaseOrder,
  RippleEffect,
} from '@/types';

/**
 * Impact engine. Pure functions over a Dataset — independent of data source,
 * so live integration is a swap. Resolves the hierarchy
 *   Event → Lane → Container → PO → Product
 * quantifies impact across Lead Time / Cost / Service, and derives ripple
 * effects, direct vs indirect impact, and short- vs long-term split.
 */

const EMPTY_DEGREE: ImpactDegree = { leadTimeDays: 0, cost: 0, service: 0 };

function addDegree(a: ImpactDegree, b: ImpactDegree): ImpactDegree {
  return {
    leadTimeDays: a.leadTimeDays + b.leadTimeDays,
    cost: a.cost + b.cost,
    service: a.service + b.service,
  };
}

/** Does a lane traverse any port/region named by the event? */
export function laneAffectedByEvent(lane: Lane, event: Event): boolean {
  const nodes = [lane.origin, lane.destination, lane.transshipment].filter(Boolean);
  return nodes.some((n) => n && event.affectedPortCodes.includes(n.code));
}

/** Lanes this event touches (in-use and not). */
export function impactedLanes(dataset: Dataset, event: Event): Lane[] {
  return dataset.lanes.filter((l) => laneAffectedByEvent(l, event));
}

/**
 * Severity → added lead-time days. Scaled by the event's estimated duration
 * but capped so a 60-day crisis doesn't imply a 60-day delay per box.
 */
function estimatedDelayDays(event: Event, lane: Lane): number {
  const base: Record<Event['severity'], number> = {
    low: 2,
    medium: 5,
    high: 10,
    critical: 14,
  };
  const durationFactor = Math.min(1.5, 0.5 + event.estimatedDurationDays / 60);
  // Air lanes recover faster than ocean.
  const motFactor = lane.mot === 'air' ? 0.4 : lane.mot === 'sea-air' ? 0.7 : 1;
  return Math.round(base[event.severity] * durationFactor * motFactor);
}

function containerValueAndQty(
  container: Container,
  poById: Map<string, PurchaseOrder>,
): { pos: PurchaseOrder[]; value: number; qty: number } {
  const pos = container.purchaseOrderIds
    .map((id) => poById.get(id))
    .filter((p): p is PurchaseOrder => !!p);
  const value = pos.reduce((s, p) => s + p.value, 0);
  const qty = pos.reduce((s, p) => s + p.quantity, 0);
  return { pos, value, qty };
}

/** Per-container impact across LT / cost / service. */
function assessContainer(
  container: Container,
  lane: Lane,
  event: Event,
  poById: Map<string, PurchaseOrder>,
): ContainerImpact {
  const { pos, value, qty } = containerValueAndQty(container, poById);
  const delay = estimatedDelayDays(event, lane);

  // Service impact: closer to / past a KPI breach ⇒ higher service risk.
  const slack = container.kpi.daysRemaining - delay;
  const service = slack <= 0 ? 1 : slack < 7 ? 0.6 : slack < 14 ? 0.3 : 0.1;

  // Cost proxy: delay days × value-weighted holding/expedite factor, plus a
  // markdown risk on high-priority value if service is at risk.
  const highPriorityValue = pos
    .filter((p) => p.priority === 'high')
    .reduce((s, p) => s + p.value, 0);
  const holdingCost = delay * (value * 0.0008);
  const markdownRisk = service >= 0.6 ? highPriorityValue * 0.05 : 0;
  const cost = Math.round(holdingCost + markdownRisk);

  return {
    container,
    lane,
    purchaseOrders: pos,
    degree: { leadTimeDays: delay, cost, service: Math.round(service * 100) / 100 },
    kind: 'direct',
    valueAtRisk: value,
    quantityAtRisk: qty,
  };
}

/** Ripple effects: launch/commercial-linked POs whose container is at risk. */
function deriveRipples(containerImpacts: ContainerImpact[]): RippleEffect[] {
  const ripples: RippleEffect[] = [];
  for (const ci of containerImpacts) {
    // Only containers with real service risk cascade downstream.
    if (ci.degree.service < 0.3) continue;
    for (const po of ci.purchaseOrders) {
      const link = po.commercialLink ?? po.lines.find((l) => l.product.launchLink)?.product.launchLink;
      if (!link) continue;
      ripples.push({
        sourcePoId: po.id,
        target: link,
        description: `${po.poNumber} (${po.supplier}) at risk on container ${ci.container.containerNo} could slip "${link}".`,
        severity: ci.degree.service >= 0.6 ? 'high' : 'medium',
      });
    }
  }
  // De-duplicate by target+po.
  const seen = new Set<string>();
  return ripples.filter((r) => {
    const k = `${r.sourcePoId}|${r.target}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function deriveFunctions(
  containerImpacts: ContainerImpact[],
  ripples: RippleEffect[],
): BusinessFunction[] {
  const fns = new Set<BusinessFunction>(['Logistics']);
  if (containerImpacts.length) fns.add('Sourcing');
  if (containerImpacts.some((c) => c.degree.service >= 0.6)) fns.add('Customer Service');
  if (containerImpacts.some((c) => c.valueAtRisk > 200_000)) fns.add('Finance');
  if (ripples.length) {
    fns.add('Planning');
    fns.add('Merchandising');
  }
  return [...fns];
}

/**
 * Full assessment for one event. Surfaces in-use lanes as the actionable
 * subset; keeps not-in-use lanes as informational in `impactedLanes`.
 */
export function assessEvent(dataset: Dataset, event: Event): EventImpactAssessment {
  const poById = new Map(dataset.purchaseOrders.map((p) => [p.id, p]));
  const lanes = impactedLanes(dataset, event);
  const inUseLaneIds = lanes.filter((l) => l.inUse).map((l) => l.id);
  const inUseLaneSet = new Set(inUseLaneIds);

  const containerImpacts: ContainerImpact[] = [];
  for (const container of dataset.containers) {
    if (!inUseLaneSet.has(container.laneId)) continue;
    const lane = lanes.find((l) => l.id === container.laneId);
    if (!lane) continue;
    containerImpacts.push(assessContainer(container, lane, event, poById));
  }

  const ripples = deriveRipples(containerImpacts);

  const degree = containerImpacts.reduce((acc, ci) => addDegree(acc, ci.degree), EMPTY_DEGREE);
  const poCount = new Set(containerImpacts.flatMap((c) => c.purchaseOrders.map((p) => p.id))).size;

  const totals = {
    containers: containerImpacts.length,
    purchaseOrders: poCount,
    valueAtRisk: containerImpacts.reduce((s, c) => s + c.valueAtRisk, 0),
    quantityAtRisk: containerImpacts.reduce((s, c) => s + c.quantityAtRisk, 0),
    degree: {
      leadTimeDays: containerImpacts.length
        ? Math.round(degree.leadTimeDays / containerImpacts.length)
        : 0,
      cost: degree.cost,
      service: containerImpacts.length
        ? Math.round((degree.service / containerImpacts.length) * 100) / 100
        : 0,
    },
    shortTermContainers: containerImpacts.filter((c) => c.container.horizon === 'short-term').length,
    longTermContainers: containerImpacts.filter((c) => c.container.horizon === 'long-term').length,
  };

  return {
    event,
    impactedLanes: lanes,
    inUseLaneIds,
    containerImpacts,
    ripples,
    totals,
    functionsToInvolve: deriveFunctions(containerImpacts, ripples),
  };
}

export function assessAll(dataset: Dataset): EventImpactAssessment[] {
  return dataset.events.map((e) => assessEvent(dataset, e));
}
