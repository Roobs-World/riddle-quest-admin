// Shim: the Playable's save module now lives in @riddle-quest/solo so native targets share it verbatim.
export {YOUTUBE_SAVE_SCHEMA_VERSION, YOUTUBE_SAVE_BUDGET_BYTES, YOUTUBE_RECEIPT_LIMIT, createEmptyYouTubeSave, parseYouTubeSave, cloneYouTubeSave, serializeYouTubeSave, appendYouTubeReceipt} from "@riddle-quest/solo";
export type {YouTubeSaveParseResult} from "@riddle-quest/solo";
