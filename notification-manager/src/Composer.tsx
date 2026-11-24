import {useEffect, useRef, useState, type FormEvent} from "react";
import {Calendar} from "./Calendar";
import {ImageUrl, type Campaign, type CampaignRequest, type ManagementConfiguration} from "./contracts";
import {formatInstant, localDay, localTime, nextSlot, operatorTimeZone, scheduledInstant} from "./dates";
import {Icon} from "./Icons";

export function Composer({configuration, campaigns, scheduleRequest, onCreate, onUpload}: {
  configuration: ManagementConfiguration;
  campaigns: readonly Campaign[];
  scheduleRequest: {day: string; revision: number} | null;
  onCreate(request: CampaignRequest): Promise<Campaign>;
  onUpload(file: File): Promise<string>;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFailed, setImageFailed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [target, setTarget] = useState("all");
  const [mode, setMode] = useState<"now" | "scheduled">("now");
  const [day, setDay] = useState(() => localDay(nextSlot()));
  const [time, setTime] = useState(() => localTime(nextSlot()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const request = useRef<{fingerprint: string; id: string} | null>(null);
  const alive = useRef(true);
  useEffect(() => {alive.current = true; return () => {alive.current = false;};}, []);
  useEffect(() => {setImageFailed(false);}, [imageUrl]);
  useEffect(() => {
    if (!scheduleRequest) return;
    setDay(scheduleRequest.day);
    setMode("scheduled");
    setSuccess(null);
  }, [scheduleRequest]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || uploading) return;
    setError(null); setSuccess(null);
    const cleanTitle = title.trim(), cleanBody = body.trim();
    if (!cleanTitle || !cleanBody) {setError("Add a title and a message before sending."); return;}
    const cleanImage = imageUrl.trim() || null;
    if (cleanImage && !ImageUrl.safeParse(cleanImage).success) {setError("Use a complete HTTPS image URL without credentials or a fragment, or upload an image."); return;}
    if (new TextEncoder().encode(JSON.stringify({title: cleanTitle, body: cleanBody, imageUrl: cleanImage})).byteLength > 3000) {setError("This notification exceeds the push payload budget. Shorten the title, message, or image URL."); return;}
    if (target !== "all" && !configuration.platforms.some(platform => platform.id === target)) {setError("Choose an available audience."); return;}
    const sendAt = mode === "now" ? null : scheduledInstant(day, time);
    if (mode === "scheduled" && (!sendAt || Date.parse(sendAt) <= Date.now())) {setError("Choose a valid future date and time. Some local times do not exist when daylight saving changes."); return;}
    const input = {title: cleanTitle, body: cleanBody, imageUrl: cleanImage, target, sendAt};
    const fingerprint = JSON.stringify(input);
    if (!request.current || request.current.fingerprint !== fingerprint) request.current = {fingerprint, id: crypto.randomUUID()};
    setBusy(true);
    try {
      const campaign = await onCreate({...input, requestId: request.current.id});
      if (!alive.current) return;
      setSuccess(sendAt ? `Notification scheduled for ${formatInstant(campaign.sendAt)} (${operatorTimeZone}).` : "Notification saved for immediate push delivery. Follow its progress in the queue.");
      request.current = null;
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
  const locked = busy || uploading;
  const previewImage = ImageUrl.safeParse(imageUrl.trim()).success && !imageFailed ? imageUrl.trim() : null;
  const payloadBytes = new TextEncoder().encode(JSON.stringify({title: title.trim(), body: body.trim(), imageUrl: imageUrl.trim() || null})).byteLength;
  return <div className="compose-layout">
    <form className="panel composer" onSubmit={event => {void submit(event);}}>
      <div className="panel-heading"><div><span className="eyebrow">CREATE A MESSAGE</span><h2>Write your notification.</h2></div><span className="subtle-pill"><span className="small-dot" /> Push notification</span></div>
      <div className="form-section">
        <label htmlFor="notification-title">Notification title <span>{title.length}/200</span></label>
        <input id="notification-title" type="text" placeholder="A new riddle is waiting for you" value={title} maxLength={200} required disabled={locked} onChange={event => setTitle(event.target.value)} />
        <label htmlFor="notification-body">Message <span>{body.length}/2,000</span></label>
        <textarea id="notification-body" placeholder="Give your players a reason to come back…" value={body} maxLength={2000} rows={5} required disabled={locked} onChange={event => setBody(event.target.value)} />
        <p className="field-hint">Keep it clear and personal. Messages go to players who have allowed push notifications.</p>
        <div className="image-field"><label htmlFor="notification-image">Image <span>Optional</span></label><input id="notification-image" type="url" inputMode="url" placeholder="https://your-site.com/notification.jpg" value={imageUrl} maxLength={2048} disabled={locked} onChange={event => setImageUrl(event.target.value)} /><div className="image-actions"><label className={`upload-button ${locked ? "disabled" : ""}`} htmlFor="notification-image-upload"><Icon name="plus" size={16} />{uploading ? "Uploading image…" : "Upload an image"}<input id="notification-image-upload" type="file" accept="image/png,image/jpeg,image/webp" disabled={locked} onChange={event => {const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file);}} /></label>{imageUrl && <button type="button" className="text-button" disabled={locked} onClick={() => setImageUrl("")}>Remove image</button>}</div><p className="field-hint">PNG, JPEG, or WebP up to 2 MB. Images are public and appear on supported devices.</p></div>
        <p className={`payload-budget ${payloadBytes > 3000 ? "over-budget" : ""}`} aria-live="polite">{payloadBytes.toLocaleString()} / 3,000 bytes of push content</p>
        <label htmlFor="notification-audience">Audience</label>
        <select id="notification-audience" value={target} disabled={locked || noAudience} onChange={event => setTarget(event.target.value)}>
          <option value="all">All registered platforms</option>
          {configuration.platforms.map(platform => <option key={platform.id} value={platform.id}>{platform.id.charAt(0).toUpperCase() + platform.id.slice(1)}</option>)}
        </select>
        {noAudience && <p className="inline-message" role="status">No platforms are configured for hosted push yet. Add an allowed game origin in the service settings before sending.</p>}
      </div>
      <div className="form-section delivery-section">
        <label>When should it go out?</label>
        <div className="delivery-options" role="group" aria-label="Delivery time">
          <button type="button" className={mode === "now" ? "selected" : ""} aria-pressed={mode === "now"} disabled={locked} onClick={() => setMode("now")}><Icon name="send" /><span><strong>Send now</strong><small>Start push delivery immediately</small></span></button>
          <button type="button" className={mode === "scheduled" ? "selected" : ""} aria-pressed={mode === "scheduled"} disabled={locked} onClick={() => setMode("scheduled")}><Icon name="calendar" /><span><strong>Schedule</strong><small>Choose a date and time</small></span></button>
        </div>
        {mode === "scheduled" && <div className="schedule-fields">
          <Calendar compact selectedDay={day} onSelect={setDay} campaigns={campaigns} disallowPast disabled={locked} />
          <div className="date-inputs">
            <div><label htmlFor="schedule-day">Date</label><input id="schedule-day" type="date" value={day} min={localDay(new Date())} required disabled={locked} onChange={event => setDay(event.target.value)} /></div>
            <div><label htmlFor="schedule-time">Time</label><input id="schedule-time" type="time" value={time} step="1" required disabled={locked} onChange={event => setTime(event.target.value)} /></div>
          </div>
          <p className="timezone"><Icon name="clock" size={14} /> All times in {operatorTimeZone}. Delivery begins at the scheduled time.</p>
        </div>}
      </div>
      <div className="composer-footer">
        {error && <p className="inline-message error-message" role="alert">{error}</p>}
        {success && <p className="inline-message success-message" role="status"><Icon name="check" size={18} />{success}</p>}
        <div className="composer-actions"><span><Icon name="shield" size={15} /> Push only. No email or SMS.</span><button className="button-primary" type="submit" disabled={locked || noAudience || payloadBytes > 3000}>{busy ? <><span className="spinner" /> Saving notification…</> : <><Icon name={mode === "now" ? "send" : "calendar"} size={18} /> {mode === "now" ? "Send notification" : "Schedule notification"}</>}</button></div>
      </div>
    </form>
    <aside className="preview-column" aria-label="Notification preview">
      <div className="preview-intro"><span className="eyebrow">LIVE PREVIEW</span><h3>Preview your message.</h3><p>{!title.trim() && !body.trim() ? "Placeholder content. Write your own title and message to send." : "The browser decides the final appearance."}</p></div>
      <div className="notification-preview">
        <div className="preview-orbit orbit-one" /><div className="preview-orbit orbit-two" />
        <div className="preview-clock">9:41</div><div className="preview-date">Notification preview</div>
        <div className="push-card"><div className="push-card-header"><span className="app-mark small"><Icon name="bell" size={16} /></span><span>RIDDLE QUEST</span><small>now</small></div><h4>{title.trim() || "Your next great message"}</h4><p>{body.trim() || "Your notification will appear here as you write. A small nudge toward another good riddle."}</p>{previewImage && <img className="push-image" src={previewImage} referrerPolicy="no-referrer" alt="Notification image preview" onError={() => setImageFailed(true)} />}{imageFailed && <span className="image-preview-error">The image could not be loaded. Check its public URL.</span>}<span className="push-card-origin">Riddle Quest</span></div>
      </div>
      <div className="preview-note"><span className="note-icon"><Icon name="bell" size={20} /></span><div><strong>A welcome nudge</strong><p>A short title and one clear thought work best on a lock screen.</p></div></div>
      <div className="delivery-note"><Icon name="shield" size={18} /><p>Delivery counts show acceptance by the push service, not confirmation that a device displayed the message.</p></div>
    </aside>
  </div>;
}
