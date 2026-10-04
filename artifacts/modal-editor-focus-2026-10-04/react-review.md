# React and accessibility review

- Focus memory is private transient DOM state in a ref; actual native focus events update it, without rendering or new document subscriptions.
- The existing committed keyboard policy remains authoritative. Closing clears the remembered control in a layout effect; abandoned renders cannot clear the visible editor.
- Deferred focus keeps an eligible active input or selected button, preserving native caret and selection. When focus was displaced by an overlay, only a control still present in the current modal/inner confirmation scope may resume.
- Removed, disabled and previous-page controls fall back to the current scope. A detached, inert, covered or retired shell cannot accept the deferred focus callback.
- Existing page-switch trigger return, nested confirmation ownership, canceled/composing key admission, mandatory completion locks and callback publication remain intact.
- One actual component changed, with no public props, visible strings, locale keys, target adapters, network calls or provider dependencies added. No memoization, state synchronization or external SDK was introduced.
- Tests use the actual component and native browser input. Fixture buttons model external updates while retaining focus with prevented mousedown. The hold-focus diagnostic is fixture-only; final runs use ordinary animation frames.
- This pass improves input continuity; it does not establish new network, frame-rate or hardware latency measurements.
