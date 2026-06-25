# Lane Disruption Intelligence

A supply-chain **disruption intelligence tool** for a global apparel & footwear
Sourcing & Logistics org. It detects external events that may impact shipping
and air lanes, determines whether those lanes are actually in use, identifies
the impacted containers, drills down to the POs and products inside them,
quantifies the impact across **Lead Time / Cost / Service**, and proposes
ranked alternatives.

> Single source of truth for **"what is disrupted, what does it cost me, and
> what do I do about it."**

This is a **prototype-first** build (per §0 of the spec): synthetic/mock data
behind clean adapter interfaces, so wiring real SAP/GPS/carrier/news systems is
a swap, not a rewrite. See [`INTEGRATION.md`](./INTEGRATION.md).

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
npm test           # engine unit tests (vitest)
```

## What it does (capabilities, in priority order)

1. **Event detection** — pluggable feed; events classified (type, geography,
   estimated duration, severity, confidence) by an LLM service.
2. **Lane impact + "is the lane actually in use?"** — maps events to lanes by
   MOT and node; only **in-use** lanes are actionable, idle lanes stay informational.
3. **Container drill-down** — Event → Lane → Container → PO → Product, every
   node expandable; per-container PO count, value, OTD countdown, milestone, ETA.
4. **Impact quantification** — counts, value/qty at risk, LT/cost/service
   degree, direct vs indirect **ripple effects**, short- vs long-term split.
5. **Alternatives engine** — skip-port-call, alternative MOT, alternative
   carrier (incl. outside the pool), capacity-checked, with LT & cost deltas.
   "**Can I switch carriers and avoid this entirely?**" is a first-class answer.
6. **Reporting & actions** — one-click automated report per event; centralized
   action overview with owner, status, and functions to involve.

## Architecture

```
EventSource ─┐
Visibility  ─┤  adapters (mock in v1)      services
ERP (SAP)   ─┤   src/adapters              src/services
Carrier     ─┘                              ├─ impactEngine     (Event→Lane→Container→PO→Product, LT/cost/service, ripples)
                                            ├─ alternativesEngine (MOT/carrier/capacity deltas, "switch carrier to avoid?")
LLMService  ───  src/services/llm           ├─ reportingService (automated report)
                                            └─ llm/mockLLM      (classify + suggest, offline)

UI (React + TS, single-page dashboard)  src/components, src/state/store.tsx
```

- **Engines are data-source agnostic** — pure functions over the typed model in
  `src/types`.
- **LLM is isolated** behind `LLMService` (classification + suggestion only).
- **Deterministic mock data** (`src/data/mockData.ts`, seeded) — 1+ active
  disruption, 10 lanes, ~44 containers, 320 POs, 48 products, 8 carriers.

## Layout

- **Left** — event feed (severity, est. duration, confidence, in-use scope).
- **Center** — impact summary (counts, value, LT/cost/service, ripples,
  functions to involve), impacted-lane view, filters, and the drill-down tree.
- **Right** — alternatives panel ("switch carrier to avoid?" banner + ranked
  options) and the report / action overview.

Filters everywhere: priority, MOT, short/long-term horizon, min value, min margin;
sort by service risk, KPI countdown, value, or margin.

## Next steps to go live

Implement the adapter + LLM interfaces against real systems — see
[`INTEGRATION.md`](./INTEGRATION.md) for each contract (SAP, GPS/visibility
provider, carrier capacity APIs, news/advisory sources, and a Claude-backed
`LLMService`).
