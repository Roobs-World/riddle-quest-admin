// Shim: the Playable's save module now lives in src/solo so native targets share it verbatim.
export {YOUTUBE_SAVE_SCHEMA_VERSION, YOUTUBE_SAVE_BUDGET_BYTES, YOUTUBE_RECEIPT_LIMIT, createEmptyYouTubeSave, parseYouTubeSave, cloneYouTubeSave, serializeYouTubeSave, appendYouTubeReceipt} from "../../solo";
export type {YouTubeSaveParseResult} from "../../solo";
