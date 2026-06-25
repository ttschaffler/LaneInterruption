# Real-integration contracts

v1 ships **mock-backed adapters** and a **deterministic mock LLM** so the full
impact and alternatives logic runs offline. Going live means implementing the
interfaces below against real systems — the engines and UI consume only the
typed shapes in `src/types`, so integration is a swap, not a rewrite.

All adapter interfaces live in `src/adapters/interfaces.ts`; the LLM interface
lives in `src/services/llm/LLMService.ts`. To go live, provide a production
implementation and pass it where `createMockAdapters` / `createMockLLM` are
called in `src/state/store.tsx`.

---

## 1. `EventSource` — news / bulletins / advisories

**Mock:** `createMockEventSource` returns seeded events.

**Live contract:**
- Poll/subscribe to news APIs, port authority advisories, and carrier
  bulletins. Each raw item becomes a `RawBulletin { source, text, publishedAt }`.
- Pass every bulletin through `LLMService.classifyEvent` to derive
  `type`, `affectedGeographies`, `affectedPortCodes`, `severity`,
  `estimatedDurationDays`, `confidence`.
- Resolve free-text place names to UN/LOCODE port codes (a geocoding/gazetteer
  step) so `affectedPortCodes` lines up with the codes used on `Lane`.
- De-duplicate recurring stories into a single evolving `Event`.
- Return `Event[]` from `fetchEvents()`.

**Suggested sources:** Lloyd's List / gCaptain feeds, carrier service advisories
(Maersk, MSC, CMA CGM), port authority status pages, NOAA/typhoon feeds.

---

## 2. `VisibilityProvider` — GPS / in-transit milestones (Factory→LSP)

**Mock:** `createMockVisibilityProvider` returns seeded lanes + containers.

**Live contract:**
- Integrate the visibility/GPS provider (e.g. project44, FourKites, GT Nexus,
  or carrier EDI 315 events).
- Map provider milestones onto `Milestone { name, location, plannedAt,
  actualAt, completed }` for the canonical sequence
  gate-in → port-out → transshipment → port-in → delivery.
- Populate `Container.currentMilestoneIndex`, `eta`, and the `KPI` countdown
  (target date minus now). Set `horizon` = `short-term` once the box is gated
  in / in transit, else `long-term`.
- Emit the operating `Lane[]` with the **`inUse`** flag set from live booking
  data — this is what gates the "is the lane actually in use?" logic.
- Preserve **T1 vs T2** provenance on the supplier side (`PurchaseOrder.supplierTier`).

---

## 3. `ERPAdapter` — SAP (system of record at destination)

**Mock:** `createMockERPAdapter` returns seeded POs + products.

**Live contract:**
- Read POs, lines, products, value and margin from SAP (BAPI / OData / S/4HANA
  APIs, or a data-warehouse mirror).
- Map to `PurchaseOrder` (qty, value, **margin**, `priority`,
  `commercialLink`) and `Product` (`unitValue`, `unitMargin`, `launchLink`).
- `priority` and launch/commercial linkage typically come from
  merchandising/planning master data, joined here.
- `getPurchaseOrders(ids)` must resolve the IDs referenced by
  `Container.purchaseOrderIds` from the visibility provider — agree the join
  key (PO number) between SAP and the visibility feed up front.

---

## 4. `CarrierAdapter` — capacity & alternative carriers/rates

**Mock:** `createMockCarrierAdapter` returns seeded carriers with a 0..1
`capacityLevel`.

**Live contract:**
- Pull contracted-pool carriers plus spot/market carriers, their served
  `modes`, and live `capacityLevel` per lane (allocation APIs, NVOCC/forwarder
  portals, or rate/capacity platforms).
- `findCarriers({ mot, includeOutsidePool })` powers the alternatives engine's
  carrier-switch options, including **outside-pool** options.
- Capacity feeds the `capacityFeasible` flag and the
  "can I switch carriers and avoid this entirely?" answer — keep it fresh.

---

## 5. `LLMService` — classification + suggestion

**Mock:** `createMockLLM` uses keyword heuristics, fully offline.

**Live contract (recommended: Claude):**
- `classifyEvent(bulletin)` → structured `EventClassification`. Use a
  tool/structured-output call so the model returns typed fields directly;
  validate against the `EventClassification` shape before trusting it.
- `suggestAlternatives({ event, lane, containers })` → `SuggestedAlternative[]`.
  Ground the prompt with the lane, affected node, container KPIs, and available
  carriers/capacity so suggestions are actionable, and clearly separate
  in-scope vs general-market options (`fromGeneralMarket`).
- Keep both calls behind `LLMService` — no other module imports a provider SDK.
- Treat LLM output as advisory: the deterministic engines still compute LT/cost
  deltas and capacity feasibility; the LLM adds narrative options and rationale.

---

## Wiring summary

```ts
// src/state/store.tsx — swap these two factories for live implementations:
const adapters = createMockAdapters(dataset);   // → real EventSource/Visibility/ERP/Carrier
const llm = createMockLLM();                     // → Claude-backed LLMService
```

Everything downstream — `impactEngine`, `alternativesEngine`,
`reportingService`, and all components — is data-source agnostic.
