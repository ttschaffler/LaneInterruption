import type {
  Carrier,
  Container,
  Dataset,
  Event,
  Lane,
  Milestone,
  ModeOfTransport,
  POLine,
  Priority,
  Product,
  PurchaseOrder,
  Action,
  KPI,
  MilestoneName,
} from '@/types';
import { PORTS } from './ports';
import { makeRng } from './rng';

/** Fixed "now" so the demo dataset is deterministic. */
export const NOW = new Date('2026-06-25T00:00:00Z');

const DAY = 24 * 60 * 60 * 1000;
const iso = (d: Date) => d.toISOString();
const addDays = (base: Date, days: number) => new Date(base.getTime() + days * DAY);

const PRODUCT_CATEGORIES = [
  'Footwear',
  'Apparel - Tops',
  'Apparel - Bottoms',
  'Outerwear',
  'Accessories',
  'Performance',
];

const SUPPLIERS = [
  'Pou Chen',
  'Feng Tay',
  'Eclat Textile',
  'Makalot',
  'Crystal Group',
  'Shenzhou Intl',
  'Far Eastern',
];

const LAUNCHES = [
  'FW26 Running Launch',
  'Holiday Capsule',
  'Spring Basics Refresh',
  'Pro Performance Drop',
];

/**
 * Lane blueprints. Origins in Asia, destinations in EU/US, some via Suez,
 * Singapore or Colombo so the seeded events have lanes to hit.
 */
const LANE_BLUEPRINTS: Array<{
  origin: keyof typeof PORTS;
  destination: keyof typeof PORTS;
  transshipment?: keyof typeof PORTS;
  mot: ModeOfTransport;
  transitDays: number;
  inUse: boolean;
}> = [
  { origin: 'CNSHA', destination: 'NLRTM', transshipment: 'EGSUZ', mot: 'sea', transitDays: 32, inUse: true },
  { origin: 'CNNGB', destination: 'DEHAM', transshipment: 'EGSUZ', mot: 'sea', transitDays: 34, inUse: true },
  { origin: 'VNSGN', destination: 'NLRTM', transshipment: 'SGSIN', mot: 'sea', transitDays: 30, inUse: true },
  { origin: 'BDCGP', destination: 'DEHAM', transshipment: 'LKCMB', mot: 'sea', transitDays: 33, inUse: true },
  { origin: 'CNYTN', destination: 'USLAX', mot: 'sea', transitDays: 18, inUse: true },
  { origin: 'VNSGN', destination: 'USNYC', transshipment: 'SGSIN', mot: 'sea', transitDays: 35, inUse: true },
  { origin: 'HKHKG', destination: 'FRADFRA', mot: 'air', transitDays: 3, inUse: true },
  { origin: 'CNSHA', destination: 'NLRTM', transshipment: 'SGSIN', mot: 'sea-air', transitDays: 12, inUse: true },
  { origin: 'CNSHA', destination: 'DEHAM', mot: 'rail', transitDays: 20, inUse: false },
  { origin: 'CNNGB', destination: 'USLAX', mot: 'sea', transitDays: 19, inUse: false },
];

function buildLanes(): Lane[] {
  return LANE_BLUEPRINTS.map((b, i) => ({
    id: `lane-${i + 1}`,
    origin: PORTS[b.origin],
    destination: PORTS[b.destination],
    transshipment: b.transshipment ? PORTS[b.transshipment] : undefined,
    mot: b.mot,
    inUse: b.inUse,
    transitDays: b.transitDays,
  }));
}

function buildCarriers(): Carrier[] {
  return [
    { id: 'car-1', name: 'Maersk', inPool: true, modes: ['sea', 'sea-air'], capacityLevel: 0.45 },
    { id: 'car-2', name: 'MSC', inPool: true, modes: ['sea'], capacityLevel: 0.6 },
    { id: 'car-3', name: 'CMA CGM', inPool: true, modes: ['sea', 'sea-air'], capacityLevel: 0.3 },
    { id: 'car-4', name: 'Hapag-Lloyd', inPool: true, modes: ['sea'], capacityLevel: 0.7 },
    { id: 'car-5', name: 'Lufthansa Cargo', inPool: true, modes: ['air', 'sea-air'], capacityLevel: 0.55 },
    { id: 'car-6', name: 'DB Schenker Rail', inPool: true, modes: ['rail'], capacityLevel: 0.8 },
    { id: 'car-7', name: 'ONE (Ocean Network)', inPool: false, modes: ['sea'], capacityLevel: 0.65 },
    { id: 'car-8', name: 'Qatar Airways Cargo', inPool: false, modes: ['air', 'sea-air'], capacityLevel: 0.5 },
  ];
}

function buildProducts(rng: ReturnType<typeof makeRng>): Product[] {
  const products: Product[] = [];
  for (let i = 0; i < 48; i++) {
    const unitValue = rng.int(12, 140);
    const marginPct = rng.float(0.18, 0.55);
    products.push({
      id: `prod-${i + 1}`,
      sku: `SKU-${1000 + i}`,
      name: `${rng.pick(['Aero', 'Vapor', 'Trail', 'Court', 'Flux', 'Storm', 'Pace', 'Drift'])} ${rng.pick(['Runner', 'Tee', 'Pant', 'Jacket', 'Cap', 'Short', 'Hoodie'])}`,
      category: rng.pick(PRODUCT_CATEGORIES),
      unitValue,
      unitMargin: Math.round(unitValue * marginPct * 100) / 100,
      launchLink: rng.chance(0.25) ? rng.pick(LAUNCHES) : undefined,
    });
  }
  return products;
}

function buildPurchaseOrders(rng: ReturnType<typeof makeRng>, products: Product[]): PurchaseOrder[] {
  const pos: PurchaseOrder[] = [];
  for (let i = 0; i < 320; i++) {
    const lineCount = rng.int(1, 4);
    const lines: POLine[] = [];
    for (let l = 0; l < lineCount; l++) {
      lines.push({ product: rng.pick(products), quantity: rng.int(200, 4000) });
    }
    const value = lines.reduce((s, ln) => s + ln.product.unitValue * ln.quantity, 0);
    const margin = lines.reduce((s, ln) => s + ln.product.unitMargin * ln.quantity, 0);
    const quantity = lines.reduce((s, ln) => s + ln.quantity, 0);
    const priority: Priority = rng.chance(0.35) ? 'high' : 'low';
    const launch = lines.find((l) => l.product.launchLink)?.product.launchLink;
    pos.push({
      id: `po-${i + 1}`,
      poNumber: `PO-${45000 + i}`,
      supplier: rng.pick(SUPPLIERS),
      supplierTier: rng.chance(0.7) ? 'T1' : 'T2',
      lines,
      value: Math.round(value),
      quantity,
      margin: Math.round(margin),
      priority,
      commercialLink: launch ?? (rng.chance(0.15) ? rng.pick(LAUNCHES) : undefined),
    });
  }
  return pos;
}

const MILESTONE_SEQUENCE: MilestoneName[] = [
  'gate-in',
  'port-out',
  'transshipment',
  'port-in',
  'delivery',
];

function buildMilestones(lane: Lane, departureOffsetDays: number): { milestones: Milestone[]; eta: Date } {
  const names = lane.transshipment
    ? MILESTONE_SEQUENCE
    : MILESTONE_SEQUENCE.filter((n) => n !== 'transshipment');

  const start = addDays(NOW, departureOffsetDays);
  const milestones: Milestone[] = [];
  const total = lane.transitDays;
  // Distribute milestone fractions across the transit window.
  const fractions: Record<MilestoneName, number> = {
    'gate-in': 0,
    'port-out': 0.08,
    transshipment: 0.5,
    'port-in': 0.92,
    delivery: 1,
  };
  let eta = start;
  for (const name of names) {
    const at = addDays(start, Math.round(total * fractions[name]));
    const completed = at.getTime() <= NOW.getTime();
    milestones.push({
      name,
      location:
        name === 'gate-in' || name === 'port-out'
          ? lane.origin
          : name === 'transshipment'
            ? lane.transshipment ?? lane.origin
            : lane.destination,
      plannedAt: iso(at),
      actualAt: completed ? iso(at) : undefined,
      completed,
    });
    if (name === 'delivery') eta = at;
  }
  return { milestones, eta };
}

function currentMilestoneIndex(milestones: Milestone[]): number {
  let idx = 0;
  milestones.forEach((m, i) => {
    if (m.completed) idx = i;
  });
  return idx;
}

function buildContainers(
  rng: ReturnType<typeof makeRng>,
  lanes: Lane[],
  carriers: Carrier[],
  pos: PurchaseOrder[],
): Container[] {
  const containers: Container[] = [];
  let poCursor = 0;
  const usableLanes = lanes.filter((l) => l.inUse);

  for (let i = 0; i < 44; i++) {
    const lane = rng.pick(usableLanes);
    const eligibleCarriers = carriers.filter((c) => c.inPool && c.modes.includes(lane.mot));
    const carrier = (eligibleCarriers.length ? rng.pick(eligibleCarriers) : carriers[0]);

    // Departure spread: some already in transit (negative), some upcoming
    // within the +6 week (42 day) horizon.
    const departureOffset = rng.int(-25, 30);
    const { milestones, eta } = buildMilestones(lane, departureOffset);
    const cmi = currentMilestoneIndex(milestones);

    // Assign 4–10 POs per container.
    const poCount = rng.int(4, 10);
    const poIds: string[] = [];
    for (let p = 0; p < poCount && poCursor < pos.length; p++) {
      poIds.push(pos[poCursor++].id);
    }
    if (poIds.length === 0) poIds.push(rng.pick(pos).id);

    // KPI: on-time delivery target a few days after planned ETA.
    const otdTarget = addDays(eta, rng.int(0, 5));
    const daysRemaining = Math.round((otdTarget.getTime() - NOW.getTime()) / DAY);
    const kpi: KPI = {
      name: 'OTD',
      targetDate: iso(otdTarget),
      daysRemaining,
      breached: daysRemaining < 0,
    };

    const inTransit = milestones[0].completed && !milestones[milestones.length - 1].completed;
    containers.push({
      id: `cont-${i + 1}`,
      containerNo: `${rng.pick(['MSKU', 'MSCU', 'CMAU', 'HLXU'])}${rng.int(100000, 999999)}`,
      laneId: lane.id,
      carrierId: carrier.id,
      mot: lane.mot,
      purchaseOrderIds: poIds,
      milestones,
      currentMilestoneIndex: cmi,
      eta: iso(eta),
      kpi,
      horizon: inTransit || departureOffset <= 0 ? 'short-term' : 'long-term',
    });
  }
  return containers;
}

/**
 * Seeded events. At least one active disruption (Suez) plus several others
 * across the event-type taxonomy, including predicted ones.
 */
function buildEvents(): Event[] {
  return [
    {
      id: 'evt-1',
      type: 'canal-strait-disruption',
      title: 'Red Sea / Suez transit suspensions widen',
      description:
        'Multiple carriers announce further Red Sea routing suspensions; Suez transits diverted around Cape of Good Hope, adding 10–14 days to Asia–Europe sailings.',
      source: 'Lloyd\'s List (LLM-classified)',
      detectedAt: iso(addDays(NOW, -2)),
      affectedGeographies: ['Red Sea', 'Suez Canal', 'Asia–Europe'],
      affectedPortCodes: ['EGSUZ'],
      severity: 'critical',
      estimatedDurationDays: 60,
      confidence: 0.88,
      predicted: false,
    },
    {
      id: 'evt-2',
      type: 'port-congestion',
      title: 'Singapore transshipment congestion building',
      description:
        'Berth waiting times at Singapore climbing past 5 days as vessels bunch following Red Sea diversions.',
      source: 'Port advisory (LLM-classified)',
      detectedAt: iso(addDays(NOW, -1)),
      affectedGeographies: ['Singapore', 'Southeast Asia'],
      affectedPortCodes: ['SGSIN'],
      severity: 'high',
      estimatedDurationDays: 21,
      confidence: 0.76,
      predicted: false,
    },
    {
      id: 'evt-3',
      type: 'strike',
      title: 'Hamburg dockworker strike threatened',
      description:
        'Union ballot signals possible 48–72h warning strike at Hamburg terminals within two weeks.',
      source: 'Regional news (LLM-classified)',
      detectedAt: iso(addDays(NOW, 0)),
      affectedGeographies: ['Hamburg', 'North Europe'],
      affectedPortCodes: ['DEHAM'],
      severity: 'medium',
      estimatedDurationDays: 3,
      confidence: 0.52,
      predicted: true,
    },
    {
      id: 'evt-4',
      type: 'severe-weather',
      title: 'Typhoon track threatens Yantian/Hong Kong',
      description:
        'Forecast typhoon could force port closures and flight cancellations across the Pearl River Delta in ~10 days.',
      source: 'Weather feed (LLM-classified)',
      detectedAt: iso(addDays(NOW, 0)),
      affectedGeographies: ['Pearl River Delta', 'South China'],
      affectedPortCodes: ['CNYTN', 'HKHKG'],
      severity: 'high',
      estimatedDurationDays: 5,
      confidence: 0.61,
      predicted: true,
    },
    {
      id: 'evt-5',
      type: 'carrier-capacity-withdrawal',
      title: 'Blank sailings announced on Colombo feeder',
      description:
        'Carrier withdraws two feeder sailings via Colombo, reducing capacity on Bangladesh–Europe routings.',
      source: 'Carrier bulletin (LLM-classified)',
      detectedAt: iso(addDays(NOW, -3)),
      affectedGeographies: ['Colombo', 'South Asia'],
      affectedPortCodes: ['LKCMB'],
      severity: 'medium',
      estimatedDurationDays: 14,
      confidence: 0.7,
      predicted: false,
    },
  ];
}

function buildSeedActions(events: Event[]): Action[] {
  return [
    {
      id: 'act-1',
      eventId: events[0].id,
      title: 'Evaluate air upgrade for high-priority Suez containers',
      description: 'Assess sea→air switch for FW26 launch-linked POs at risk of OTD breach.',
      owner: 'A. Novak (Logistics)',
      status: 'in-progress',
      functionsToInvolve: ['Logistics', 'Sourcing', 'Finance'],
      createdAt: iso(addDays(NOW, -1)),
    },
    {
      id: 'act-2',
      eventId: events[0].id,
      title: 'Notify Merchandising of potential launch slip',
      description: 'Flag downstream ripple to FW26 Running Launch to commercial owners.',
      owner: 'R. Mbeki (Planning)',
      status: 'open',
      functionsToInvolve: ['Planning', 'Merchandising'],
      createdAt: iso(addDays(NOW, -1)),
    },
  ];
}

export function generateDataset(seed = 42): Dataset {
  const rng = makeRng(seed);
  const lanes = buildLanes();
  const carriers = buildCarriers();
  const products = buildProducts(rng);
  const purchaseOrders = buildPurchaseOrders(rng, products);
  const containers = buildContainers(rng, lanes, carriers, purchaseOrders);
  const events = buildEvents();
  const actions = buildSeedActions(events);
  return { events, lanes, containers, purchaseOrders, products, carriers, actions };
}
