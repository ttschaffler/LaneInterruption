import { useStore } from '@/state/store';
import { severityRank } from '@/utils/format';

export function EventFeed() {
  const { assessments, selectedEventId, selectEvent } = useStore();
  const sorted = [...assessments].sort(
    (a, b) =>
      severityRank(b.event.severity) - severityRank(a.event.severity) ||
      b.totals.valueAtRisk - a.totals.valueAtRisk,
  );

  return (
    <div>
      <div className="section-title">Event feed · {assessments.length}</div>
      {sorted.map((a) => {
        const e = a.event;
        return (
          <div
            key={e.id}
            className={`event-card ${e.id === selectedEventId ? 'selected' : ''}`}
            onClick={() => selectEvent(e.id)}
          >
            <div className="title">{e.title}</div>
            <div className="meta">
              <span className={`badge ${e.severity}`}>{e.severity}</span>
              {e.predicted && <span className="badge predicted">predicted</span>}
              <span className="badge ghost">{e.type.replace(/-/g, ' ')}</span>
            </div>
            <div className="meta" style={{ marginTop: 6 }}>
              <span>⏱ ~{e.estimatedDurationDays}d</span>
              <span>🎯 {(e.confidence * 100).toFixed(0)}% conf</span>
              {a.totals.containers > 0 ? (
                <span className="badge inuse">{a.totals.containers} cont · {a.inUseLaneIds.length} lane(s)</span>
              ) : (
                <span className="muted">no in-use lanes</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
