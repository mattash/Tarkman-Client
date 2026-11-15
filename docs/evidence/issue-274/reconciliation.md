# Reviewed feature reconciliation onto current main

## First reconciliation — main `813d52d5`

- Reviewed Library head: `9468c49090c4a80fbfa7ef88775ae1b68f45eb4f`, based on `d459fa5e9e2685b7cbc9f8e79605e0bc2f4b2b1d`.
- Actual new main: `813d52d5caa118a9bf941fbf0330df51acd2be9e`, including the completed negative Siri feasibility report (#279), not positive Siri acceptance.
- Rebased feature-only head: `904fe9279b1210663060d41e5ae9c2171041279a`. Seven existing commits rebased cleanly; no conflict resolution or feature edits were needed.
- The complete binary-capable Git feature patches (`--binary --no-ext-diff --no-renames`) from old base→reviewed head and new main→rebased feature head are **byte-identical**, including source, tests and image bytes: **2,153,417 bytes**, SHA-256 `6d2651617d6e1e0740567b79c8d6a3453e357577626ad2981c80c42d9ee8ca47`.
- This provenance file is the only additional change after that feature-only comparison. Excluding this file, the final branch delta is verified against the same patch before publication.
- Existing reviewer-credit trailers are preserved on all seven rebased commits; the provenance commit carries the same credit. All ticket commits remain authored by `tarkman-agent`.

Existing captures and execution results retain their **original recorded source revisions**. Rebase equivalence is not a new application capture, device run or VoiceOver result. The corrected real native initial/repeat result remains the captured `bdc1c45` result documented in the [native record](./native-validation.md).

No unchanged local full suite or phone test was rerun for this reconciliation. Required combined CI/Vercel and exact posted-head independent review are recorded in the PR description when complete.

VoiceOver audible/focus validation remains **UNVERIFIED**. The owner requested restoration; the broader phone pause is an orchestration coordination hold. No phone action, VoiceOver enablement, new operator prompt or acceptance waiver follows from this source-only reconciliation. The PR remains draft pending the already-raised acceptance decision.

## Widget-checkpoint reconciliation — main `41301128`

- Reviewed prior head: `71890bb1a3a2423c4240d3208db5268bd36fd631`, based on `813d52d5`.
- New actual main: `41301128bb714e3e0e097465e7b34aff064a8265` (isolated widget preparation #282).
- All eight existing ticket commits rebased without conflicts or edits to `c78a9d7d7ce694977f8e1d56c165561fa1e9d326` before updating this provenance file.
- The entire reviewed delta, including the earlier provenance note, is byte-identical across that rebase: 2,155,716 bytes, SHA-256 `bb43161387e78b46cbd9b1336d43df76605ceb003d2bb0e9b79451df1dfec0b1`.
- Excluding only this provenance file, source/tests/images remain the same original 2,153,417-byte feature patch with SHA-256 `6d2651617d6e1e0740567b79c8d6a3453e357577626ad2981c80c42d9ee8ca47`; the final published head is checked against those exact bytes before pushing.
- This provenance update is the sole additional change. Existing credit is retained on all eight rebased commits, with the same credit on the new provenance commit. No unchanged local/full/native/phone case was rerun; combined checks/Vercel and exact-head review are recorded in the PR description.

Historical capture source identities above are unchanged. The actual VoiceOver check never began; the later 10-second explicit-project launch timeout is an **UNKNOWN** connectivity/setup result, not evidence of lock or privacy denial. OFF was verified. The coordination hold and no-enable/no-new-prompt constraint remain; this reconciliation does not answer or waive the pending acceptance decision.
