import {useCallback, useRef, useState} from "react";
import {createLiveRaceDraft, type LiveRaceDraft} from "../logic/liveRaceDraft";

/** Owns ordered local draft transitions and publishes their immutable projection to React. */
export function useLiveRaceDraft() {
  /** Rendered projection may batch edits without owning their event ordering. */
  const [draft, publishDraft] = useState(() => createLiveRaceDraft(null));
  /** Only transitions advance this snapshot; a delayed render cannot rewind it. */
  const currentDraft = useRef(draft);
  /** Submission reads every preceding edit, including those not yet rendered. */
  const getDraft = useCallback(() => currentDraft.current, []);
  /** Pure transitions run once when admitted, outside React's replayable state updater. */
  const updateDraft = useCallback((transition: (current: LiveRaceDraft) => LiveRaceDraft) => {
    /** Latest local intent precedes input, receipt and rejection transitions. */
    const next = transition(currentDraft.current);
    if (next === currentDraft.current) return;
    currentDraft.current = next;
    publishDraft(next);
  }, []);
  return {draft, getDraft, updateDraft};
}
