import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  Action,
  Alternative,
  BusinessFunction,
  Dataset,
  EventImpactAssessment,
} from '@/types';
import { generateDataset } from '@/data/mockData';
import { createMockAdapters, type Adapters } from '@/adapters/mock';
import { createMockLLM } from '@/services/llm/mockLLM';
import { assessAll } from '@/services/impactEngine';
import { buildAlternatives, type AlternativesResult } from '@/services/alternativesEngine';
import { applyFilters, DEFAULT_FILTERS, sortImpacts, type FilterState, type SortKey } from '@/utils/filters';
import { buildEventReport } from '@/services/reportingService';

interface StoreValue {
  dataset: Dataset;
  adapters: Adapters;
  assessments: EventImpactAssessment[];
  selectedEventId: string | null;
  selectedAssessment: EventImpactAssessment | null;
  selectEvent: (id: string) => void;
  filters: FilterState;
  setFilters: (f: FilterState) => void;
  sortKey: SortKey;
  setSortKey: (k: SortKey) => void;
  /** Filtered + sorted container impacts for the selected event. */
  visibleImpacts: EventImpactAssessment['containerImpacts'];
  alternatives: Record<string, AlternativesResult>;
  loadAlternatives: (laneId: string) => Promise<void>;
  actions: Action[];
  addActionFromAlternative: (alt: Alternative, functions: BusinessFunction[]) => void;
  updateActionStatus: (id: string, status: Action['status']) => void;
  generateReport: () => string;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const dataset = useMemo(() => generateDataset(), []);
  const adapters = useMemo(() => createMockAdapters(dataset), [dataset]);
  const llm = useMemo(() => createMockLLM(), []);
  const assessments = useMemo(() => assessAll(dataset), [dataset]);

  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    assessments.find((a) => a.totals.containers > 0)?.event.id ?? assessments[0]?.event.id ?? null,
  );
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>('service');
  const [alternatives, setAlternatives] = useState<Record<string, AlternativesResult>>({});
  const [actions, setActions] = useState<Action[]>(dataset.actions);

  const selectedAssessment = useMemo(
    () => assessments.find((a) => a.event.id === selectedEventId) ?? null,
    [assessments, selectedEventId],
  );

  const visibleImpacts = useMemo(() => {
    if (!selectedAssessment) return [];
    return sortImpacts(applyFilters(selectedAssessment.containerImpacts, filters), sortKey);
  }, [selectedAssessment, filters, sortKey]);

  const selectEvent = useCallback((id: string) => {
    setSelectedEventId(id);
    setAlternatives({});
  }, []);

  const loadAlternatives = useCallback(
    async (laneId: string) => {
      if (!selectedAssessment) return;
      const lane = selectedAssessment.impactedLanes.find((l) => l.id === laneId);
      if (!lane) return;
      const impacts = selectedAssessment.containerImpacts.filter((c) => c.lane.id === laneId);
      const result = await buildAlternatives(
        dataset,
        selectedAssessment.event,
        lane,
        impacts,
        llm,
        (mot, includeOutsidePool) =>
          dataset.carriers.filter((c) => c.modes.includes(mot) && (includeOutsidePool || c.inPool)),
      );
      setAlternatives((prev) => ({ ...prev, [laneId]: result }));
    },
    [dataset, llm, selectedAssessment],
  );

  const addActionFromAlternative = useCallback(
    (alt: Alternative, functions: BusinessFunction[]) => {
      if (!selectedAssessment) return;
      const id = `act-${Date.now()}`;
      setActions((prev) => [
        {
          id,
          eventId: selectedAssessment.event.id,
          title: alt.title,
          description: alt.description,
          owner: 'Unassigned',
          status: 'open',
          functionsToInvolve: functions,
          alternativeId: alt.id,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    },
    [selectedAssessment],
  );

  const updateActionStatus = useCallback((id: string, status: Action['status']) => {
    setActions((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  }, []);

  const generateReport = useCallback(() => {
    if (!selectedAssessment) return '';
    return buildEventReport(selectedAssessment);
  }, [selectedAssessment]);

  // Eagerly load alternatives for the first in-use lane of the selected event.
  useEffect(() => {
    const firstLane = selectedAssessment?.inUseLaneIds[0];
    if (firstLane && !alternatives[firstLane]) void loadAlternatives(firstLane);
  }, [selectedAssessment, alternatives, loadAlternatives]);

  const value: StoreValue = {
    dataset,
    adapters,
    assessments,
    selectedEventId,
    selectedAssessment,
    selectEvent,
    filters,
    setFilters,
    sortKey,
    setSortKey,
    visibleImpacts,
    alternatives,
    loadAlternatives,
    actions,
    addActionFromAlternative,
    updateActionStatus,
    generateReport,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
