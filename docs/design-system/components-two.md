# Component review gallery — second group

Status: visually accepted as the basis for journey assembly, 2026-09-12. Builds on the approved foundations and first component group. Neither application consumes the gallery. No dependencies, production fonts, preferences, or app routes were changed. Acceptance does not establish native runtime or accessibility sign-off.

Conversation specimen: [tarkman-components-two.html](specimens/tarkman-components-two.html). Review settings provide system/light/dark appearance, web/native-style presentation, 100/150/200% specimen text and long-content fixtures. Review chrome stays normal-sized. The scale control is not browser zoom or native Dynamic Type.

## Component contracts under review

| Component | Candidate behavior | Review coverage |
| --- | --- | --- |
| Field | Persistent label; helper text independent of placeholder; focus ring; explicit invalid state and recovery text; editable, read-only and disabled semantics | Service-code format check by button or Enter, blank/invalid/success feedback, stale feedback cleared on edit, copyable read-only title, disabled field with reason, editable multilingual textarea |
| Service row | Full row is one selection target; serif title, available languages and state badge; explicit selected label and boundary | Three example rows with English/Russian/Armenian titles; live/paused/ended badges; long mixed-script titles; selecting another row clears prior selection |
| Service card | Bounded surface for a standalone service; one primary reading action and separate details action | Surface radius/padding, state, title, metadata, wrapping actions, expandable sample details |
| Status notice | Text names the state and its consequence; theme-paired status color; distinguish service pause from interrupted connection | Live, paused, reconnecting, failed and empty fixtures; last-received passage labeled as potentially stale; retry demonstrates reconnecting then live without networking |
| Dialog/sheet surface | Reading context remains intact; close at the start and return action at the end; focus returns to trigger | Web-centered surface and native-style top-corner treatment, English/Russian/Armenian excerpts, long content, Close / Back to reading / Escape dismissal |

Service states and titles are illustrative fixtures, not live service records. The 4–8 letter/digit code rule is a local validation example, not an approved API contract. A success result confirms only fixture format. The textarea is a field specimen, not a proposed new prayer-editing feature.

The overlay uses an in-flow region explicitly labeled as a visual specimen. It does not declare itself a modal or claim to trap focus. Actual web modal/popover behavior, scroll containment, screen-reader announcements, native back/swipe behavior, safe areas and keyboard avoidance remain platform implementation work. Returning to reading in this preview preserves existing content and focuses the opening control; it does not verify an app reading-position persistence mechanism.

## Content and assets

- The three prayer excerpts preserve the opening lines from `apps/mobile/design/samples.ts`. Long-content mode repeats the same excerpts and joins existing titles to stress wrapping; it is not a longer liturgical edition.
- Explanation body copy is a layout sample, not sourced theological commentary. Fluent-reader and editorial review remain necessary before production content adoption.
- The full-coverage Armenian regular/bold fonts are embedded unchanged from the repository, with full OFL and author attribution. Hashes match the pinned files described in [the first component gallery](components.md). Source Serif 4 remains Google Fonts web delivery.
- Embedded palette/metric manifest equals `foundations.tokens.json`. Native uses the selected 17px body baseline in the browser specimen; all native dimensions remain logical-unit proposals requiring runtime validation.
- No icon library choice was introduced. These specimens use visible action labels; the Lucide/Ionicons comparison remains in the first gallery.

## Verification and findings

- Inspected web layout at 1024px and native-style layout at 390px/320px, including dark appearance, 200% specimen text and long content. Measured root/stage widths showed no horizontal overflow in inspected field, service and overlay states. Single-line input text retains native horizontal scrolling when longer than the field.
- Confirmed service-row selection and explicit selected text; reconnecting notice and last-received qualifier; empty state with a check-again action that preserves the empty fixture; overlay opening, Close/return actions, Escape and focus return.
- Found and fixed the format-check interaction in the sandboxed preview: validation now runs from a button click or Enter in the code field, without depending on a form submission. Blank input reports the required-field error; `AB` reports the format error; `DEMO` reports format success; editing clears old feedback. Error focus returns to the field. No data is submitted.
- Browser reported reading fonts loaded. The unchanged Armenian font hashes were verified during embedding.
- JavaScript parsed successfully; embedded token equality passed; Impeccable 4.3.1 static detector returned `[]`.
- [Six additional opaque color pairs](component-two-contrast.json) meet 4.5:1 for field feedback and hovered service metadata. Foundation and first-gallery reports cover the other reused foreground/background roles. This is not a full rendered accessibility audit.

Pending: production modal behavior, keyboard and screen-reader journey coverage, actual browser zoom, native Dynamic Type and runtime rendering, native safe areas/keyboard, reduced-motion and OS appearance transitions, long service data, and real API loading/recovery behavior. No application test/build run was needed for these isolated review artifacts.

## Next gate

The user agreed to proceed to complete service-discovery → language selection → reading → explanation journeys. See [the assembled reading journey](reading-journey.md) for the next review, including recovery states. App integration remains a separate explicit authorization.
