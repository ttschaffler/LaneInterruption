import { useEffect } from 'react';
import { useStore } from '@/state/store';
import type { Alternative } from '@/types';
import { formatCurrency, formatDelta } from '@/utils/format';

function AltCard({ alt, top }: { alt: Alternative; top: boolean }) {
  const { selectedAssessment, addActionFromAlternative } = useStore();
  return (
    <div className={`alt-card ${top ? 'top' : ''}`}>
      <div className="title">
        {alt.title}
        {alt.avoidsDisruption && <span className="badge low">avoids</span>}
        {alt.fromGeneralMarket && <span className="badge ghost">market</span>}
        {!alt.capacityFeasible && <span className="badge critical">no capacity</span>}
      </div>
      <div className="desc">{alt.description}</div>
      <div className="muted" style={{ fontSize: 11 }}>{alt.rationale}</div>
      <div className="alt-deltas">
        <span className="dim lt"><span className="k">LT</span><span className="v">{formatDelta(alt.leadTimeDeltaDays, 'd')}</span></span>
        <span className="dim cost"><span className="k">Cost</span><span className="v">{alt.costDelta >= 0 ? '+' : ''}{formatCurrency(alt.costDelta)}</span></span>
        <span className="dim"><span className="k">Score</span><span className="v">{alt.score}</span></span>
        <button
          className="btn sm"
          style={{ marginLeft: 'auto' }}
          onClick={() =>
            addActionFromAlternative(alt, selectedAssessment?.functionsToInvolve ?? ['Logistics'])
          }
        >
          + Action
        </button>
      </div>
    </div>
  );
}

export function AlternativesPanel({ selectedLaneId }: { selectedLaneId: string | null }) {
  const { selectedAssessment, alternatives, loadAlternatives } = useStore();
  const laneId = selectedLaneId ?? selectedAssessment?.inUseLaneIds[0] ?? null;

  useEffect(() => {
    if (laneId && !alternatives[laneId]) void loadAlternatives(laneId);
  }, [laneId, alternatives, loadAlternatives]);

  if (!selectedAssessment) return null;
  if (!laneId) return <div className="empty">No in-use lane to optimise.</div>;

  const result = alternatives[laneId];
  const lane = selectedAssessment.impactedLanes.find((l) => l.id === laneId);

  return (
    <div>
      <div className="section-title">
        Alternatives {lane ? `· ${lane.origin.name}→${lane.destination.name}` : ''}
      </div>

      {result ? (
        <>
          <div className={`answer-banner ${result.canSwitchCarrierToAvoid ? 'yes' : 'no'}`}>
            {result.canSwitchCarrierToAvoid
              ? `✅ Yes — you can switch carriers and avoid this entirely${
                  result.switchCarrierOption ? ` (${result.switchCarrierOption.title.replace('Switch to ', '')})` : ''
                }.`
              : '⚠️ No single carrier switch fully avoids this — combine with a mode or routing change.'}
          </div>
          {result.options.map((alt, i) => (
            <AltCard key={alt.id} alt={alt} top={i === 0} />
          ))}
        </>
      ) : (
        <div className="empty">Computing alternatives…</div>
      )}
    </div>
  );
}
