import {useEffect, useRef, useState, type FormEvent} from "react";
import {Calendar} from "./Calendar";
import {ImageUrl, type Campaign, type CampaignRequest, type ManagementConfiguration} from "./contracts";
import {formatInstant, localDay, localTime, nextSlot, operatorTimeZone, scheduledInstant} from "./dates";
import {Icon} from "./Icons";
import {exportDraft, importDraft, readDraftLibrary, readWorkingDraft, writeDraftLibrary, writeWorkingDraft, type DraftValues, type SavedDraft} from "./drafts";

export function Composer({configuration, campaigns, scheduleRequest, onCreate, onUpload, draftOwner, localOnly = false}: {
  configuration: ManagementConfiguration;
  campaigns: readonly Campaign[];
  scheduleRequest: {day: string; revision: number} | null;
  onCreate(request: CampaignRequest): Promise<Campaign>;
  onUpload(file: File): Promise<string>;
  draftOwner: string;
  localOnly?: boolean;
}) {
  const [initial] = useState(() => {
    let working: ReturnType<typeof readWorkingDraft> = null;
    let library: SavedDraft[] | null = null;
    let error: string | null = null;
    try {working = readWorkingDraft(draftOwner);} catch {error = "Your working draft could not be read. Existing saved data has not been replaced.";}
    try {library = readDraftLibrary(draftOwner);} catch {error = "The draft library could not be read. Export your work before leaving; existing saved drafts have not been replaced.";}
    return {working, library, error};
  });
  const [title, setTitle] = useState(initial.working?.values.title ?? "");
  const [body, setBody] = useState(initial.working?.values.body ?? "");
  const [imageUrl, setImageUrl] = useState(initial.working?.values.imageUrl ?? "");
  const [imageFailed, setImageFailed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [target, setTarget] = useState(initial.working?.values.target ?? "all");
  const [mode, setMode] = useState<"now" | "scheduled">(initial.working?.values.mode ?? "now");
  const [day, setDay] = useState(() => initial.working?.values.day ?? localDay(nextSlot()));
  const [time, setTime] = useState(() => initial.working?.values.time ?? localTime(nextSlot()));
  const [library, setLibrary] = useState<SavedDraft[] | null>(initial.library);
  const [draftError, setDraftError] = useState<string | null>(initial.error);
  const [draftNotice, setDraftNotice] = useState<string | null>(initial.working ? "Restored your last draft on this browser." : null);
  const [previewDevice, setPreviewDevice] = useState<"android" | "ios" | "desktop">("android");
  const [selectedDraft, setSelectedDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const request = useRef<{fingerprint: string; id: string} | null>(initial.working?.attempt ?? null);
  const values: DraftValues = {title, body, imageUrl, target, mode, day, time};
  const encodedValues = JSON.stringify(values);
  const previousValues = useRef(encodedValues);
  useEffect(() => {
    if (previousValues.current === encodedValues) return;
    try {
      writeWorkingDraft(draftOwner, {values: {title, body, imageUrl, target, mode, day, time}, attempt: request.current});
      previousValues.current = encodedValues;
      setDraftError(null);
    } catch {setDraftError("This browser could not save your draft. Export a copy before leaving.");}
  }, [encodedValues, draftOwner, title, body, imageUrl, target, mode, day, time]);
  const alive = useRef(true);
  useEffect(() => {alive.current = true; return () => {alive.current = false;};}, []);
  useEffect(() => {setImageFailed(false);}, [imageUrl]);
  useEffect(() => {
    if (!scheduleRequest) return;
    setDay(scheduleRequest.day);
    setMode("scheduled");
    setSuccess(null);
  }, [scheduleRequest]);
  const loadDraft = (draft: DraftValues, id: string | null = null) => {
    setTitle(draft.title); setBody(draft.body); setImageUrl(draft.imageUrl); setTarget(draft.target);
    setMode(draft.mode); setDay(draft.day); setTime(draft.time);
    setSelectedDraft(id); request.current = null;
    setError(null); setSuccess(null); setDraftNotice("Draft loaded. Review the audience and date before sending.");
    try {writeWorkingDraft(draftOwner, {values: draft, attempt: null});}
    catch {setDraftError("This browser could not save your draft. Export a copy before leaving.");}
  };
  const saveDraft = () => {
    if (!library) return;
    const id = selectedDraft ?? crypto.randomUUID();
    try {
      const drafts = [{id, updatedAt: new Date().toISOString(), values}, ...readDraftLibrary(draftOwner).filter(draft => draft.id !== id)];
      if (drafts.length > 25) {setDraftError("You have 25 saved drafts. Delete one before saving another, or export this draft."); return;}
      writeDraftLibrary(draftOwner, drafts); setLibrary(drafts); setSelectedDraft(id); setDraftNotice("Draft saved on this browser. It has not been sent or scheduled."); setDraftError(null);}
    catch {setDraftError("The draft could not be saved. Export a copy before leaving.");}
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || uploading) return;
    if (localOnly) {saveDraft(); return;}
    setError(null); setSuccess(null);
    const cleanTitle = title.trim(), cleanBody = body.trim();
    if (!cleanTitle || !cleanBody) {setError("Add a title and a message before sending."); return;}
    const cleanImage = imageUrl.trim() || null;
    if (cleanImage && !ImageUrl.safeParse(cleanImage).success) {setError("Use a complete HTTPS image URL without credentials or a fragment, or upload an image."); return;}
    if (new TextEncoder().encode(JSON.stringify({title: cleanTitle, body: cleanBody, imageUrl: cleanImage})).byteLength > 3000) {setError("This notification exceeds the push payload budget. Shorten the title, message, or image URL."); return;}
    if (target !== "all" && !configuration.platforms.some(platform => platform.id === target)) {setError("Choose an available audience."); return;}
    const sendAt = mode === "now" ? null : scheduledInstant(day, time);
    if (mode === "scheduled" && !sendAt) {setError("Choose a valid date and time. Some local times do not exist when daylight saving changes."); return;}
    const input = {title: cleanTitle, body: cleanBody, imageUrl: cleanImage, target, sendAt};
    const fingerprint = JSON.stringify(input);
    if (sendAt && Date.parse(sendAt) <= Date.now() && request.current?.fingerprint !== fingerprint) {setError("Choose a future date and time."); return;}
    if (!request.current || request.current.fingerprint !== fingerprint) request.current = {fingerprint, id: crypto.randomUUID()};
    try {writeWorkingDraft(draftOwner, {values, attempt: request.current});}
    catch {setDraftError("Request recovery could not be saved on this browser. Check delivery history before retrying after a reload.");}
    setBusy(true);
    try {
      const campaign = await onCreate({...input, requestId: request.current.id});
      if (!alive.current) return;
      setSuccess(sendAt ? `Notification scheduled for ${formatInstant(campaign.sendAt)} (${operatorTimeZone}).` : "Notification saved for immediate push delivery. Follow its progress in the queue.");
      request.current = null;
      setSelectedDraft(null);
      setTitle(""); setBody(""); setImageUrl("");
    } catch (failure) {
      if (alive.current) setError(failure instanceof Error ? failure.message : "The request failed. Your draft is safe; please try again.");
    } finally {if (alive.current) setBusy(false);}
  };
  const upload = async (file: File) => {
    if (busy || uploading) return;
    setUploading(true); setError(null); setSuccess(null);
    try {const url = await onUpload(file); if (alive.current) setImageUrl(url);}
    catch (failure) {if (alive.current) setError(failure instanceof Error ? failure.message : "The image could not be uploaded. Your draft is safe.");}
    finally {if (alive.current) setUploading(false);}
  };
  const noAudience = configuration.platforms.length === 0;
  const locked = busy || uploading || importing;
  const previewImage = ImageUrl.safeParse(imageUrl.trim()).success && !imageFailed ? imageUrl.trim() : null;
  const payloadBytes = new TextEncoder().encode(JSON.stringify({title: title.trim(), body: body.trim(), imageUrl: imageUrl.trim() || null})).byteLength;
  return <div className="compose-layout">
    <form className="panel composer" onSubmit={event => {void submit(event);}}>
      <div className="panel-heading"><div><span className="eyebrow">CREATE A MESSAGE</span><h2>Write your notification.</h2></div><span className="subtle-pill"><span className="small-dot" /> Push notification</span></div>
      <div className="draft-tools">
        <div className="draft-actions"><button type="button" className="button-secondary compact-button" disabled={locked || library === null} onClick={saveDraft}>Save draft</button>
          <button type="button" className="text-button" disabled={locked} onClick={() => exportDraft(values)}>Export draft</button>
          <label className="upload-button">Import draft<input type="file" accept="application/json,.json" disabled={locked} onChange={event => {const file = event.target.files?.[0]; event.target.value = ""; if (file) {setImporting(true); void importDraft(file).then(draft => {if (alive.current) loadDraft(draft);}).catch(() => {if (alive.current) setDraftError("This file is not a valid notification draft.");}).finally(() => {if (alive.current) setImporting(false);});}}} /></label>
          <button type="button" className="text-button" disabled={locked} onClick={() => {if ((!title && !body && !imageUrl) || window.confirm("Clear the current editor? Saved drafts will stay in the library.")) loadDraft({title: "", body: "", imageUrl: "", target: "all", mode: "now", day: localDay(nextSlot()), time: localTime(nextSlot())});}}>New draft</button>
        </div>
        {library && library.length > 0 && <div className="draft-library"><label htmlFor="saved-draft">Saved on this browser</label><select id="saved-draft" disabled={locked} value={selectedDraft ?? ""} onChange={event => {const draft = library.find(value => value.id === event.target.value); if (draft) loadDraft(draft.values, draft.id);}}><option value="">Choose a draft…</option>{library.map(draft => <option key={draft.id} value={draft.id}>{draft.values.title || "Untitled draft"} · {formatInstant(draft.updatedAt)}</option>)}</select>
          <button type="button" className="text-danger" disabled={locked || !selectedDraft} onClick={() => {if (!window.confirm("Delete this saved draft? The current editor will remain open.")) return; try {const next = readDraftLibrary(draftOwner).filter(draft => draft.id !== selectedDraft); writeDraftLibrary(draftOwner, next); setLibrary(next); setSelectedDraft(null); setDraftNotice("Saved draft deleted. The editor is unchanged.");} catch {setDraftError("The saved draft could not be deleted.");}}}>Delete loaded draft</button></div>}
        {draftError && <p role="alert" className="inline-message error-message">{draftError}</p>}
        {draftNotice && <p role="status" className="field-hint">{draftNotice}</p>}
      </div>
      <div className="form-section">
        <label htmlFor="notification-title">Notification title <span>{title.length}/200</span></label>
        <input id="notification-title" type="text" placeholder="A new riddle is waiting for you" value={title} maxLength={200} required disabled={locked} onChange={event => setTitle(event.target.value)} />
        <label htmlFor="notification-body">Message <span>{body.length}/2,000</span></label>
        <textarea id="notification-body" placeholder="Give your players a reason to come back…" value={body} maxLength={2000} rows={5} required disabled={locked} onChange={event => setBody(event.target.value)} />
        <p className="field-hint">Keep it clear and personal. Messages go to players who have allowed push notifications.</p>
        <div className="image-field"><label htmlFor="notification-image">Image <span>Optional</span></label><input id="notification-image" type="url" inputMode="url" placeholder="https://your-site.com/notification.jpg" value={imageUrl} maxLength={2048} disabled={locked} onChange={event => setImageUrl(event.target.value)} /><div className="image-actions"><label className={`upload-button ${locked || localOnly ? "disabled" : ""}`} htmlFor="notification-image-upload"><Icon name="plus" size={16} />{uploading ? "Uploading image…" : "Upload an image"}<input id="notification-image-upload" type="file" accept="image/png,image/jpeg,image/webp" disabled={locked || localOnly} onChange={event => {const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file);}} /></label>{imageUrl && <button type="button" className="text-button" disabled={locked} onClick={() => setImageUrl("")}>Remove image</button>}</div><p className="field-hint">PNG, JPEG, or WebP up to 2 MB. Images are public and appear on supported devices.</p></div>
        <p className={`payload-budget ${payloadBytes > 3000 ? "over-budget" : ""}`} aria-live="polite">{payloadBytes.toLocaleString()} / 3,000 bytes of push content</p>
        <label htmlFor="notification-audience">Audience</label>
        <select id="notification-audience" value={target} disabled={locked || noAudience} onChange={event => setTarget(event.target.value)}>
          <option value="all">All registered platforms</option>
          {target !== "all" && !configuration.platforms.some(platform => platform.id === target) && <option value={target}>{target} (not connected)</option>}
          {configuration.platforms.map(platform => <option key={platform.id} value={platform.id}>{platform.id.charAt(0).toUpperCase() + platform.id.slice(1)}</option>)}
        </select>
        {noAudience && <p className="inline-message" role="status">No delivery audiences are connected. You can save a draft and choose its audience later.</p>}
      </div>
      <div className="form-section delivery-section">
        <label>When should it go out?</label>
        <div className="delivery-options" role="group" aria-label="Delivery time">
          <button type="button" className={mode === "now" ? "selected" : ""} aria-pressed={mode === "now"} disabled={locked} onClick={() => setMode("now")}><Icon name="send" /><span><strong>Send now</strong><small>Start push delivery immediately</small></span></button>
          <button type="button" className={mode === "scheduled" ? "selected" : ""} aria-pressed={mode === "scheduled"} disabled={locked} onClick={() => setMode("scheduled")}><Icon name="calendar" /><span><strong>Schedule</strong><small>Choose a date and time</small></span></button>
        </div>
        {mode === "scheduled" && <div className="schedule-fields">
          <Calendar compact selectedDay={day} onSelect={setDay} campaigns={campaigns} draftDays={localOnly ? library?.filter(draft => draft.values.mode === "scheduled").map(draft => draft.values.day) : undefined} disallowPast disabled={locked} />
          <div className="date-inputs">
            <div><label htmlFor="schedule-day">Date</label><input id="schedule-day" type="date" value={day} min={localDay(new Date())} required disabled={locked} onChange={event => setDay(event.target.value)} /></div>
            <div><label htmlFor="schedule-time">Time</label><input id="schedule-time" type="time" value={time} step="1" required disabled={locked} onChange={event => setTime(event.target.value)} /></div>
          </div>
          <p className="timezone"><Icon name="clock" size={14} /> All times in {operatorTimeZone}. {localOnly ? "Calendar markers show local drafts, not scheduled deliveries." : "Delivery begins at the scheduled time."}</p>
        </div>}
      </div>
      <div className="composer-footer">
        {error && <p className="inline-message error-message" role="alert">{error}</p>}
        {success && <p className="inline-message success-message" role="status"><Icon name="check" size={18} />{success}</p>}
        <div className="composer-actions"><span><Icon name="shield" size={15} /> Push only. No email or SMS.</span><button className="button-primary" type="submit" disabled={locked || noAudience || payloadBytes > 3000}>{busy ? <><span className="spinner" /> Saving notification…</> : <><Icon name={mode === "now" ? "send" : "calendar"} size={18} /> {mode === "now" ? "Send notification" : "Schedule notification"}</>}</button></div>
      </div>
    </form>
    <aside className={`preview-column preview-${previewDevice}`} aria-label="Notification preview"><div className="preview-device-tabs" role="group" aria-label="Preview device">{(["android", "ios", "desktop"] satisfies Array<typeof previewDevice>).map(device => <button key={device} type="button" aria-pressed={previewDevice === device} onClick={() => setPreviewDevice(device)}>{device === "ios" ? "iOS" : device === "android" ? "Android" : "Desktop"}</button>)}</div>
      <div className="preview-intro"><span className="eyebrow">LIVE PREVIEW</span><h3>Preview your message.</h3><p>{!title.trim() && !body.trim() ? "Placeholder content. Write your own title and message to send." : "Layout preview only. The operating system decides the final appearance; iOS web notifications may omit images."}</p></div>
      <div className="notification-preview">
        <div className="preview-orbit orbit-one" /><div className="preview-orbit orbit-two" />
        {previewDevice !== "desktop" && <div className="preview-clock">9:41</div>}<div className="preview-date">Notification preview</div>
        <div className="push-card"><div className="push-card-header"><span className="app-mark small"><Icon name="bell" size={16} /></span><span>RIDDLE QUEST</span><small>now</small></div><h4>{title.trim() || "Your next great message"}</h4><p>{body.trim() || "Your notification will appear here as you write. A small nudge toward another good riddle."}</p>{previewImage && previewDevice !== "ios" && <img className="push-image" src={previewImage} referrerPolicy="no-referrer" alt="Notification image preview" onError={() => setImageFailed(true)} />}{imageFailed && <span className="image-preview-error">The image could not be loaded. Check its public URL.</span>}<span className="push-card-origin">Riddle Quest</span></div>
      </div>
      <div className="preview-note"><span className="note-icon"><Icon name="bell" size={20} /></span><div><strong>A welcome nudge</strong><p>A short title and one clear thought work best on a lock screen.</p></div></div>
      <div className="delivery-note"><Icon name="shield" size={18} /><p>Delivery counts show acceptance by the push service, not confirmation that a device displayed the message.</p></div>
    </aside>
  </div>;
}
