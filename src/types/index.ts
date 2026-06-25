/**
 * Domain model for the Lane Disruption Intelligence tool.
 *
 * Physical flow:  Factory ─► CFS ─► 3PL ─► LSP (ocean/air carrier) ─► Market
 * Visibility horizon: predictive view of +6 weeks, T1 (direct) and T2 (sub-tier).
 *
 * Every entity below maps to §5 of the build brief and is consumed by the
 * impact engine, alternatives engine and dashboard UI. Adapters (SAP, GPS,
 * carrier, news) produce/consume these shapes so live integration is a swap.
 */

// ---------------------------------------------------------------------------
// Shared enums / unions
// ---------------------------------------------------------------------------

export type ModeOfTransport = 'sea' | 'air' | 'sea-air' | 'rail';

export type EventType =
  | 'port-congestion'
  | 'port-closure'
  | 'canal-strait-disruption'
  | 'strike'
  | 'severe-weather'
  | 'geopolitical'
  | 'carrier-capacity-withdrawal'
  | 'skipped-port-call';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export type Priority = 'high' | 'low';

/** Whether a shipment is already moving (short-term) or not yet shipped (long-term). */
export type ImpactHorizon = 'short-term' | 'long-term';

export type ActionStatus = 'open' | 'in-progress' | 'resolved' | 'dismissed';

export type SupplierTier = 'T1' | 'T2';

/** Business function that may need to be informed / involved in a response. */
export type BusinessFunction =
  | 'Sourcing'
  | 'Logistics'
  | 'Planning'
  | 'Merchandising'
  | 'Finance'
  | 'Customer Service'
  | 'Quality';

// ---------------------------------------------------------------------------
// Geography
// ---------------------------------------------------------------------------

export interface GeoPoint {
  /** UN/LOCODE-style code, e.g. "CNSHA". */
  code: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
}

// ---------------------------------------------------------------------------
// Event (from EventSource adapter, classified by the LLM service)
// ---------------------------------------------------------------------------

export interface Event {
  id: string;
  type: EventType;
  title: string;
  /** Free-text summary as it arrived from the feed. */
  description: string;
  source: string;
  /** ISO date the event was detected/published. */
  detectedAt: string;
  /** Geographies / ports / regions the event affects. */
  affectedGeographies: string[];
  /** Port codes directly named by the event, used to match lanes. */
  affectedPortCodes: string[];
  severity: Severity;
  /** LLM estimate, "how long will the crisis last", in days. */
  estimatedDurationDays: number;
  /** Classifier confidence 0..1. */
  confidence: number;
  /** True if this is a predicted/forecast event vs. an active one. */
  predicted: boolean;
}

// ---------------------------------------------------------------------------
// Lane
// ---------------------------------------------------------------------------

export interface Lane {
  id: string;
  origin: GeoPoint;
  destination: GeoPoint;
  transshipment?: GeoPoint;
  mot: ModeOfTransport;
  /** Whether live shipments are currently moving on this lane. */
  inUse: boolean;
  /** Typical transit window for the lane, in days. */
  transitDays: number;
}

// ---------------------------------------------------------------------------
// Milestones / KPI
// ---------------------------------------------------------------------------

export type MilestoneName =
  | 'gate-in'
  | 'port-out'
  | 'transshipment'
  | 'port-in'
  | 'delivery';

export interface Milestone {
  name: MilestoneName;
  location: GeoPoint;
  /** Planned ISO datetime. */
  plannedAt: string;
  /** Actual ISO datetime if the milestone has been reached. */
  actualAt?: string;
  completed: boolean;
}

export interface KPI {
  name: string;
  /** Target date for the KPI, e.g. on-time-delivery date. */
  targetDate: string;
  /** Days remaining before breach; negative means already breached. */
  daysRemaining: number;
  breached: boolean;
}

// ---------------------------------------------------------------------------
// Container → PO → Product
// ---------------------------------------------------------------------------

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  /** Unit margin in currency. */
  unitMargin: number;
  unitValue: number;
  /** Linked launch / commercial moment, if any (ripple-effect source). */
  launchLink?: string;
}

export interface POLine {
  product: Product;
  quantity: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplier: string;
  supplierTier: SupplierTier;
  lines: POLine[];
  /** Total order value in currency. */
  value: number;
  /** Total order quantity (units). */
  quantity: number;
  /** Blended margin in currency. */
  margin: number;
  priority: Priority;
  /** Commercial / launch programme this PO feeds, if any. */
  commercialLink?: string;
}

export interface Container {
  id: string;
  containerNo: string;
  laneId: string;
  carrierId: string;
  mot: ModeOfTransport;
  purchaseOrderIds: string[];
  milestones: Milestone[];
  /** Index into milestones[] for the current/last-reached milestone. */
  currentMilestoneIndex: number;
  /** Estimated time of arrival at destination (ISO datetime). */
  eta: string;
  /** Primary KPI being tracked, typically OTD. */
  kpi: KPI;
  horizon: ImpactHorizon;
}

// ---------------------------------------------------------------------------
// Carrier
// ---------------------------------------------------------------------------

export interface Carrier {
  id: string;
  name: string;
  /** Whether the carrier is in our contracted pool. */
  inPool: boolean;
  modes: ModeOfTransport[];
  /** Available capacity 0..1 on the relevant lanes (1 = fully open). */
  capacityLevel: number;
}

// ---------------------------------------------------------------------------
// Impact (computed by the impact engine)
// ---------------------------------------------------------------------------

/** The three impact dimensions every assessment is expressed across. */
export interface ImpactDegree {
  /** Added lead time in days. */
  leadTimeDays: number;
  /** Added cost in currency. */
  cost: number;
  /** Service impact 0..1 (probability/severity of OTD miss). */
  service: number;
}

export interface ContainerImpact {
  container: Container;
  lane: Lane;
  purchaseOrders: PurchaseOrder[];
  degree: ImpactDegree;
  /** Direct (lane is hit) vs indirect (downstream ripple). */
  kind: 'direct' | 'indirect';
  /** Value at risk for this container. */
  valueAtRisk: number;
  quantityAtRisk: number;
}

export interface RippleEffect {
  /** Source of the ripple, e.g. a delayed PO or component. */
  sourcePoId: string;
  /** What it cascades into (launch, commercial moment, dependent PO). */
  target: string;
  description: string;
  severity: Severity;
}

export interface EventImpactAssessment {
  event: Event;
  impactedLanes: Lane[];
  /** In-use lanes only — the actionable subset. */
  inUseLaneIds: string[];
  containerImpacts: ContainerImpact[];
  ripples: RippleEffect[];
  totals: {
    containers: number;
    purchaseOrders: number;
    valueAtRisk: number;
    quantityAtRisk: number;
    /** Aggregate degree across all impacted containers. */
    degree: ImpactDegree;
    shortTermContainers: number;
    longTermContainers: number;
  };
  /** Functions that should be informed / involved. */
  functionsToInvolve: BusinessFunction[];
}

// ---------------------------------------------------------------------------
// Alternatives (computed by the alternatives engine + LLM suggestions)
// ---------------------------------------------------------------------------

export type AlternativeKind =
  | 'reroute'
  | 'skip-port-call'
  | 'alternative-mot'
  | 'alternative-carrier'
  | 'wait';

export interface Alternative {
  id: string;
  kind: AlternativeKind;
  title: string;
  description: string;
  /** Change in lead time vs. doing nothing, in days (negative = faster). */
  leadTimeDeltaDays: number;
  /** Change in cost vs. doing nothing, in currency (positive = more expensive). */
  costDelta: number;
  /** Whether capacity exists to execute this option. */
  capacityFeasible: boolean;
  /** Suggested new carrier, if the option switches carriers. */
  carrierId?: string;
  /** True if this option is from the general market vs. our scope. */
  fromGeneralMarket: boolean;
  /** Ranking score (higher is better); set by the engine. */
  score: number;
  /** Whether this option fully avoids the disruption. */
  avoidsDisruption: boolean;
  /** Short rationale (may be LLM-authored). */
  rationale: string;
}

// ---------------------------------------------------------------------------
// Action tracking
// ---------------------------------------------------------------------------

export interface Action {
  id: string;
  eventId: string;
  title: string;
  description: string;
  owner: string;
  status: ActionStatus;
  functionsToInvolve: BusinessFunction[];
  /** Alternative this action implements, if any. */
  alternativeId?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Full dataset shape produced by the mock data layer
// ---------------------------------------------------------------------------

export interface Dataset {
  events: Event[];
  lanes: Lane[];
  containers: Container[];
  purchaseOrders: PurchaseOrder[];
  products: Product[];
  carriers: Carrier[];
  actions: Action[];
}
