# Tarkman design-system workspace

This directory preserves the selected design direction, provisional foundations and isolated review experiments. The design system is committed separately from application redesigns. Specimen approval does not make its layout prescriptive or authorize an app-wide rollout.

The [saved HTML specimens](specimens/README.md) preserve the visual proposal for future review. The [shared token package](../../packages/tarkman-design/README.md) contains candidate semantic values and generated web CSS; this foundation commit does not import them into either app. Application adoption belongs in a separate PR.

`packages/tarkman-design/tokens.json` is the source for values an application consumes, and CI checks its generated CSS and color contrast. [`foundations.tokens.json`](foundations.tokens.json) is the review manifest recorded with the foundations board; the native specimen keeps its own copied snapshot. Change the package first when a value changes.

## Start here

1. [System proposal](proposal.md): current foundation, cross-platform architecture proposal and adoption sequence.
2. [Typography study](typography-study.md): selected literary-serif direction, multilingual specimens and unresolved font/QA details.
3. [Reading-screen review](screen-review.md): web/native-style mockup scope and evidence limits.
4. [Foundations board decisions](foundations.md): proposed geometry, elevation, color, type, states and motion, with contrast evidence and a review token manifest.
5. [Component gallery](components.md): first review group covering reading text, buttons, icon comparison, and web/native-style language selection; includes the Armenian combining-mark correction and verification limits.
6. [Second component gallery](components-two.md): fields, service rows/cards, notices, and explanation dialog/sheet appearances, with behavior checks and scope limits.
7. [Complete reading journey](reading-journey.md): service discovery through language selection, reading, explanation and recovery, assembled from the selected components.
8. [Working implementation specification](implementation-spec.md): semantic roles, component contracts and platform decisions for a first application trial.
9. [Native validation](native-validation.md): isolated Expo specimen, actual runtime evidence and remaining checks.

Specimens stay provisional until the system has been applied in real screens. Use them as review evidence, not definitive or prescriptive layouts. There is no screenshot enforcement or mandatory specimen reproduction.

## References

- **Structure:** a foundations-first process: inspect existing sources, resolve conflicts, define scope and primitive values, alias semantic roles, document the foundation, then build and verify component variants. No Figma library has been built.
- **Critique:** review visual hierarchy, type rhythm, spacing, unnecessary decoration, generic composition and missing states against the selected direction. The Tarkman brief wins over any tool's aesthetic defaults.
- **Token representation:** [Design Tokens Format Module 2025.10](https://www.designtokens.org/tr/2025.10/format/) (DTCG). Use its token types and alias model when specifying an exchange format. It defines representation, not Tarkman's radius, shadow, palette or typography, and it is a Community Group specification, not a W3C Recommendation.

## Decision discipline

Every proposed foundation needs a role, rationale, source, status, and evidence. Use these statuses:

- **Observed:** verified in existing code or assets; not necessarily the desired future value.
- **Proposed:** a design choice to compare and review; not an established standard.
- **Selected:** chosen as the visual direction or value.
- **Verified:** a named check passed for a stated surface, platform, and state. Visual selection alone does not establish verification.

Example: an 8-unit control radius is proposed because it provides a softer control shape without turning every action into a pill. It is not mandated by DTCG, Figma, or accessibility guidance. The literary-serif direction is selected; exact font assets and native rendering remain pending.

Current commitments: expand the current web identity; preserve the selected literary reading direction; coordinate English, Russian, Armenian, and transliteration; support light/dark/system appearance; keep native controls usable; keep projector design a distinct review context.

Native system-sans controls are a deliberate choice, even if a general web-design heuristic discourages system fonts. Do not add gradients, ornamental motion, repeated cards, or decorative imagery merely to create visual interest.

## Foundations status

Candidate v1 is documented in [Foundations](foundations.md) and was approved as the visual foundation on 2026-09-12, with the native icon-library choice left open. Lucide is the web icon family; native should use an Expo-compatible family with matching semantic roles and visual weight. Approval does not authorize application integration.

Show alternatives only where a decision is still open, attach rationale, and record the outcome before propagating it into components. Preserve the distinction between a visual proposal, browser evidence, native-runtime evidence, and a production implementation.
