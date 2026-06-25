import { useStore } from '@/state/store';
import { formatCurrency } from '@/utils/format';

export function LaneView({
  selectedLaneId,
  onSelectLane,
}: {
  selectedLaneId: string | null;
  onSelectLane: (id: string) => void;
}) {
  const { selectedAssessment } = useStore();
  if (!selectedAssessment) return null;

  const valueByLane = new Map<string, number>();
  for (const ci of selectedAssessment.containerImpacts) {
    valueByLane.set(ci.lane.id, (valueByLane.get(ci.lane.id) ?? 0) + ci.valueAtRisk);
  }

  return (
    <div>
      <div className="section-title">
        Impacted lanes · {selectedAssessment.inUseLaneIds.length} in use / {selectedAssessment.impactedLanes.length} touched
      </div>
      {selectedAssessment.impactedLanes.map((lane) => (
        <div
          key={lane.id}
          className={`lane-row ${lane.inUse ? '' : 'notinuse'} ${lane.id === selectedLaneId ? 'selected' : ''}`}
          onClick={() => lane.inUse && onSelectLane(lane.id)}
          style={{ cursor: lane.inUse ? 'pointer' : 'default', outline: lane.id === selectedLaneId ? '1px solid var(--accent)' : 'none' }}
        >
          <span className="route">
            {lane.origin.name} → {lane.destination.name}
          </span>
          <span className="mot">{lane.mot}</span>
          {lane.transshipment && <span className="muted">via {lane.transshipment.name}</span>}
          {lane.inUse ? (
            <span className="badge inuse">in use</span>
          ) : (
            <span className="badge ghost">informational</span>
          )}
          <span className="spacer" />
          {lane.inUse && <span className="muted">{formatCurrency(valueByLane.get(lane.id) ?? 0)}</span>}
        </div>
      ))}
    </div>
  );
}
