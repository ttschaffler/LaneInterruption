import type { Dataset, ModeOfTransport } from '@/types';
import type {
  CarrierAdapter,
  ERPAdapter,
  EventSource,
  VisibilityProvider,
} from './interfaces';

/**
 * Mock adapters backed by an in-memory Dataset. They mimic async I/O so
 * swapping in real SAP/GPS/carrier/news clients keeps the same call sites.
 */

const tick = <T>(value: T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), 0));

export function createMockEventSource(data: Dataset): EventSource {
  return { fetchEvents: () => tick(data.events) };
}

export function createMockVisibilityProvider(data: Dataset): VisibilityProvider {
  return {
    fetchContainers: () => tick(data.containers),
    fetchLanes: () => tick(data.lanes),
  };
}

export function createMockERPAdapter(data: Dataset): ERPAdapter {
  const byId = new Map(data.purchaseOrders.map((p) => [p.id, p]));
  return {
    fetchPurchaseOrders: () => tick(data.purchaseOrders),
    fetchProducts: () => tick(data.products),
    getPurchaseOrders: (ids) => tick(ids.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p)),
  };
}

export function createMockCarrierAdapter(data: Dataset): CarrierAdapter {
  return {
    fetchCarriers: () => tick(data.carriers),
    findCarriers: ({ mot, includeOutsidePool }: { mot: ModeOfTransport; includeOutsidePool: boolean }) =>
      tick(
        data.carriers.filter(
          (c) => c.modes.includes(mot) && (includeOutsidePool || c.inPool),
        ),
      ),
  };
}

export interface Adapters {
  events: EventSource;
  visibility: VisibilityProvider;
  erp: ERPAdapter;
  carriers: CarrierAdapter;
}

export function createMockAdapters(data: Dataset): Adapters {
  return {
    events: createMockEventSource(data),
    visibility: createMockVisibilityProvider(data),
    erp: createMockERPAdapter(data),
    carriers: createMockCarrierAdapter(data),
  };
}
