import type {
  Carrier,
  Container,
  Event,
  Lane,
  ModeOfTransport,
  Product,
  PurchaseOrder,
} from '@/types';

/**
 * Integration seams. v1 ships mock implementations; live integration is a
 * swap of the implementation, not a rewrite of the engines that consume them.
 * Each adapter documents its real-integration contract in INTEGRATION.md.
 */

/** News / bulletins / port & carrier advisories. Classified by the LLM service. */
export interface EventSource {
  /** Return currently known events (active + predicted). */
  fetchEvents(): Promise<Event[]>;
}

/** GPS / in-transit milestones, Factory→LSP visibility (T1/T2). */
export interface VisibilityProvider {
  /** Containers currently in the +6 week horizon with milestones/ETA. */
  fetchContainers(): Promise<Container[]>;
  /** The lanes the network operates, with in-use flags. */
  fetchLanes(): Promise<Lane[]>;
}

/** System of record at destination (SAP) — POs, products, value, margin. */
export interface ERPAdapter {
  fetchPurchaseOrders(): Promise<PurchaseOrder[]>;
  fetchProducts(): Promise<Product[]>;
  getPurchaseOrders(ids: string[]): Promise<PurchaseOrder[]>;
}

/** Carrier capacity, alternative carriers / rates. */
export interface CarrierAdapter {
  fetchCarriers(): Promise<Carrier[]>;
  /** Carriers able to serve a mode on a lane, optionally outside the pool. */
  findCarriers(opts: {
    mot: ModeOfTransport;
    includeOutsidePool: boolean;
  }): Promise<Carrier[]>;
}
