# Design QA

## Comparison Target

Source visual truth:

- Full list option 1: `/Users/edwardzev/.codex/generated_images/019f50d4-fbe6-7ef1-a24e-7261b18a6a63/exec-06a6cdeb-4e26-4efc-8eb2-ffac3ec68079.png`
- Main flow option 3: `/Users/edwardzev/.codex/generated_images/019f50d4-fbe6-7ef1-a24e-7261b18a6a63/exec-c7582ca7-5bcb-4b0e-92e1-fdbe02c3ae78.png`
- Popup option 1: `/Users/edwardzev/.codex/generated_images/019f50d4-fbe6-7ef1-a24e-7261b18a6a63/exec-002b0617-4419-4907-8c6a-a96489ef10bc.png`

Browser-rendered implementation evidence:

- Full list: `/tmp/moaz-modern-list-1440x1024.png`
- Main flow with selected-order inspector: `/tmp/moaz-modern-flow-inspector-1440x1024.png`
- Full order popup: `/tmp/moaz-modern-popup-1440x1024.png`
- Mobile Full list: `/tmp/moaz-modern-list-390x844.png`
- Mobile Main flow inspector: `/tmp/moaz-modern-flow-inspector-390x844.png`
- Mobile popup: `/tmp/moaz-modern-popup-390x844.png`

Viewport and state:

- Desktop: 1440 x 1024 at device scale factor 1.
- Mobile: 390 x 844 at device scale factor 1.
- Real read-only Airtable-backed records were rendered locally through `vercel dev`.
- All POST requests used for interaction verification were intercepted and fulfilled locally; no Airtable records were changed.

## Full-view Comparison Evidence

- Full list side-by-side: `/tmp/moaz-compare-list.png`
- Main flow side-by-side: `/tmp/moaz-compare-flow.png`
- Popup side-by-side: `/tmp/moaz-compare-popup.png`

The implementation preserves the selected graphite, white, cobalt, and mint visual language, the grouped operational table, the horizontally staged Main flow, the selected-order side panel, and the dark-header order sheet. Differences in dynamic content are expected because the implementation uses current operational records rather than the concept's illustrative records.

## Focused Region Comparison Evidence

- Full list header, grouping, and first operational row: `/tmp/moaz-compare-list-focus.png`
- Main flow selected-order panel: `/tmp/moaz-compare-flow-focus.png`
- Popup header and Order details section: `/tmp/moaz-compare-popup-focus.png`

Focused comparisons were required because table labels, action icons, field typography, real thumbnail treatment, and panel controls were too small to assess reliably in the full-view composites.

## Findings

No actionable P0, P1, or P2 findings remain.

Accepted intentional deviations:

- The generated list concept includes an illustrative logo that is not an approved application asset. The implementation keeps the real `Production Tracking` identity and uses a simple cobalt brand accent instead of inventing or tracing a logo.
- The implementation retains exact operational field names, field order, card content, and write controls even where the concept shortened labels or simplified cards.
- The Main flow keeps the existing shared search/status toolbar below the header. The selected-order side panel, stage density, selection treatment, and scrolling behavior follow the chosen direction without duplicating controls or changing navigation contracts.
- The side panel intentionally uses the approved shorter subset of the full popup fields, in their original relative order. It does not add the concept's illustrative order-type or action fields.

Required fidelity surfaces:

- Fonts and typography: system UI/Inter-compatible fallbacks, weights, hierarchy, line height, RTL dynamic text, numeric emphasis, wrapping, and truncation are visually consistent with the concepts and remain readable with real long-form data.
- Spacing and layout rhythm: table grid tracks, sticky headers, stage widths, panel proportion, modal padding, section rhythm, radii, and borders match the selected dense operational direction. Desktop and mobile captures show no control overlap or inaccessible persistent action.
- Colors and visual tokens: graphite chrome, white surfaces, cobalt active/selection states, mint success actions, neutral borders, and stage-specific semantic colors map closely to the references with adequate contrast.
- Image quality and asset fidelity: real Airtable thumbnails are used at their native aspect ratio with `object-fit: contain`; no placeholder imagery, inline SVG art, CSS drawings, emoji, or text glyph substitutes are used. Phosphor supplies the interface icons.
- Copy and content: application copy is coherent and exact operational field names are preserved, including `Client name text`, `Product clent brings`, `products to buy`, and the `Carton OUT` display alias for `# of packages`.
- Accessibility and responsiveness: focus indicators, labeled search, tab semantics, explicit accessible names for icon-only mobile controls, labeled dialog and inspector close controls, keyboard card selection, reduced-motion handling, image alt text, and practical mobile layouts were checked.

## Primary Interactions Tested

- Full list/Main flow view switching and visibility.
- Job ID search remains a Job ID substring filter.
- Clicking a Full list or inspector order number opens the full 27-field popup.
- Clicking a non-interactive Main flow card surface opens the short inspector; Enter on a focused card does the same.
- Clicking the drag handle does not open the inspector.
- The display-only `Incoming Material only` stage has no drag-write value.
- Main flow move payload remains `{ id, mainFlow }` to `/api/main-flow`.
- Product in, Start, Ready, and Sent retain their exact `/api/status` payload values.
- Popup and inspector carton writes retain `/api/order-cartons` payloads.
- Empty order-number edits still send `null` to `/api/order-numbers`.
- Popup Meters and Printed North controls retain their exact `/api/meters` and `/api/printed-north` payloads and select value.
- Dropbox links retain their original `href`, `_blank` target, and `noopener noreferrer` relationship.
- Full list and popup attachment previews still open the shared viewer, while downloads retain their metadata and encoded same-origin `/api/download` path.

## Console and Runtime Checks

- JavaScript syntax check passed.
- Contract-focused Chrome CDP run passed on desktop and mobile.
- No blocking runtime exceptions or application console errors were found.
- A pre-existing `/favicon.ico` 404 remains and is classified as P3/non-blocking because it does not affect the rendered interface or core workflow.

## Comparison History

- Pre-QA render polish: an initial browser render exposed a sticky-table offset, narrow production columns, stacked popup attachment links, and wider-than-target stage columns. These were corrected before the formal combined comparison by making the table its own scroll frame, adding explicit column tracks, using compact icon-led action controls, placing popup attachment links beside the preview, and reducing stage width.
- Formal comparison pass 1: the three full-view combined inputs and three focused combined inputs listed above were opened together and reviewed. No actionable P0/P1/P2 differences remained, so no post-comparison visual fix iteration was required.
- Independent review pass: the reviewer found a P2 accessibility mismatch on mobile because Refresh, Put meters, and dialog Close hide their visible text at narrow widths. Explicit `aria-label` values were added for all three controls.
- Post-fix verification: the 390 x 844 Chrome CDP run confirmed the exact accessible names `Refresh`, `Put meters`, `Close dialog`, and `Close selected order`; the full no-write interaction suite, desktop/mobile renders, JavaScript syntax check, and diff check passed again.
- Post-polish evidence: `/tmp/moaz-modern-list-1440x1024.png`, `/tmp/moaz-modern-flow-inspector-1440x1024.png`, `/tmp/moaz-modern-popup-1440x1024.png`, plus the three combined focused comparison files.

## Follow-up Polish

- [P3] Add an approved real favicon/brand asset if one becomes available; do not synthesize one from the concept screenshot.

## Final Result

final result: passed
