# Tarkman design-system workspace

This directory preserves the selected design direction, provisional foundations and isolated review experiments. The design system is committed separately from application redesigns. Specimen approval does not make its layout prescriptive or authorize an app-wide rollout.

The [saved HTML specimens](specimens/README.md) preserve the visual proposal for future review. The [shared token package](../../packages/tarkman-design/README.md) contains candidate semantic values and generated web CSS; this foundation commit does not import them into either app. Application adoption belongs in a separate PR.

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

These files record the user's selected direction and working proposals. On 2026-09-12 the user clarified that specimens should remain provisional until the system has been applied in real screens. Use them as review evidence, not definitive or prescriptive layouts. No screenshot enforcement or mandatory specimen reproduction is authorized. Missing tool-specific `PRODUCT.md` or `DESIGN.md` files does not make Tarkman a new product or erase its direction. No tool-specific root context files have been created as part of skill installation.

## Agreed skill references

### Structure: Figma Design System Builder

Installed skill: `figma:figma-generate-library`.

Use its foundations-first process as a reference: inspect existing sources, resolve conflicts, define scope, define primitive values, alias semantic roles, document the foundation, then construct and verify component variants. Typography and effect styles belong in the foundation alongside spacing, radius, and color.

Its full execution workflow is Figma-specific. Referencing the process does not mean a Figma library was built or verified. Load `figma-use` and the full builder instructions before actual Figma work. Do not claim compliance with phases that were not executed.

### Craft and critique: Impeccable

Installed skill: `/Users/mattash/.codex/skills/impeccable/SKILL.md`.

- Authoritative repository: https://github.com/pbakaus/impeccable
- Installed version: 4.3.1
- Pinned source commit: `cb56ed6c19a07329a9fa0cd4e657bee040156593`
- Source package: `.agents/skills/impeccable`
- Installation date: 2026-09-12
- Installed through the Codex Skill Installer; its launcher was made executable and its context check passed.

Use the skill to challenge visual hierarchy, type rhythm, spacing, unnecessary decoration, generic composition and missing states. Preserve the user's selected direction. The skill explicitly states that the brief wins over its aesthetic defaults.

Use Read guidance for prayer and explanation surfaces, and Operate guidance for controls and preferences. These are intended surface classifications, not a claim that the complete Impeccable setup interview or critique has run.

Read the selected command's current instructions before running it. Formal `critique` includes independent assessments and detector/browser evidence; a quick manual review is not equivalent to that command. Follow applicable agent authorization and tool permissions. No automatic hook was enabled, no formal critique was run during installation, and no application dependency was added.

### Token representation: DTCG

Reference: [Design Tokens Format Module 2025.10](https://www.designtokens.org/tr/2025.10/format/).

Use its token types and alias model when specifying an exchange format. It defines representation and interoperability; it does not determine Tarkman's ideal radius, shadow, palette or typography. It is a Community Group specification, not a W3C Recommendation.

## Decision discipline

Every proposed foundation needs a role, rationale, source, status, and evidence. Use these statuses:

- **Observed:** verified in existing code or assets; not necessarily the desired future value.
- **Proposed:** a design choice to compare and review; not an established standard.
- **Selected:** the user chose the visual direction or value.
- **Verified:** a named check passed for a stated surface, platform, and state. Visual selection alone does not establish verification.

Example: an 8-unit control radius is proposed because it provides a softer control shape without turning every action into a pill. It is not mandated by DTCG, Figma, or accessibility guidance. The literary-serif direction is selected; exact font assets and native rendering remain pending.

Current commitments: expand the current web identity; preserve the selected literary reading direction; coordinate English, Russian, Armenian, and transliteration; support light/dark/system appearance; keep native controls usable; keep projector design a distinct review context.

Do not replace these commitments with skill presets. Native system-sans controls are a deliberate choice, even if a general web-design heuristic discourages system fonts. Do not add gradients, ornamental motion, repeated cards, or decorative imagery merely to create visual interest.

## Current artifact: foundations board

Candidate v1 is documented in [Foundations](foundations.md). The standalone conversation board compares both appearances and has passed 50 specified contrast checks. The user approved the visual foundation on 2026-09-12, with the native icon-library choice left open. Lucide is the web specimen family; native should use an appropriate Expo-compatible family with matching semantic roles and visual weight. This approval does not authorize application integration.

Before the component gallery, compare and document:

- Color roles and paired foreground/background contrast in both themes.
- Typography hierarchy with English, Russian and Armenian visible together.
- Spacing scale and control/content density.
- Border widths and roles: divider, control, selection and focus.
- Radius roles: control, card, sheet and status pill.
- Elevation: flat surface, raised surface and overlay; dark-mode tone as well as shadow.
- Gradient policy: solid reading surfaces by default, with any exception justified by a real use case.
- Interaction states and motion/reduced-motion policy.
- Icons, touch targets, content measure and platform adaptations.

Show alternatives only where a decision is still open, attach rationale, and record the outcome before propagating it into components. Test the resulting foundation with components, then complete screens. Preserve the distinction between a visual proposal, browser evidence, native-runtime evidence, and a production implementation.
