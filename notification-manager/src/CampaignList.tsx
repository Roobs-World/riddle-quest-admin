import {useEffect, useRef, useState} from "react";
import {platformLabel, statusLabels, type Campaign} from "./contracts";
import {formatInstant, operatorTimeZone} from "./dates";
import {Icon} from "./Icons";

export function campaignStatus(campaign: Campaign): string {
  return campaign.status === "queued" && Date.parse(campaign.sendAt) <= Date.now() ? "Queued" : statusLabels[campaign.status];
}

export function CampaignList({campaigns, onSelect, emptyTitle = "Nothing in the queue yet.", emptyBody = "Your notifications will appear here after you send or schedule one."}: {
  campaigns: readonly Campaign[];
  onSelect(campaign: Campaign): void;
  emptyTitle?: string;
  emptyBody?: string;
}) {
  if (campaigns.length === 0) return <div className="empty-state"><span className="empty-icon"><Icon name="bell" size={27} /></span><h3>{emptyTitle}</h3><p>{emptyBody}</p></div>;
  return <div className="table-scroll"><table className="campaign-table"><thead><tr><th>Notification</th><th>Audience</th><th>Send time</th><th>Status</th><th>Accepted</th><th><span className="visually-hidden">Details</span></th></tr></thead><tbody>{campaigns.map(campaign => <tr key={campaign.id}>
    <td><button type="button" className="notification-title" onClick={() => onSelect(campaign)}><span className="table-icon"><Icon name="bell" size={18} /></span><span><strong>{campaign.title}</strong><small>{campaign.body}</small></span></button></td>
    <td><span className="audience-label">{platformLabel(campaign.target)}</span></td>
    <td><time dateTime={campaign.sendAt}>{formatInstant(campaign.sendAt)}</time></td>
    <td><span className={`status status-${campaign.status}`}><i />{campaignStatus(campaign)}</span></td>
    <td className="count-cell">{campaign.counts.accepted.toLocaleString()}</td>
    <td><button type="button" className="icon-button" aria-label={`View ${campaign.title}`} onClick={() => onSelect(campaign)}><Icon name="right" size={18} /></button></td>
  </tr>)}</tbody></table></div>;
}

/** Details and cancellation stay in one focus-contained native dialog. */
export function CampaignDetails({campaign, onClose, onCancel}: {
  campaign: Campaign;
  onClose(): void;
  onCancel(campaign: Campaign): Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    dialog.current?.showModal();
    return () => {active.current = false; dialog.current?.close();};
  }, []);
  useEffect(() => {if (campaign.status === "cancelled" || campaign.status === "complete") setConfirming(false);}, [campaign.status]);
  const cancel = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try {await onCancel(campaign); if (active.current) setConfirming(false);}
    catch (failure) {if (active.current) setError(failure instanceof Error ? failure.message : "Cancellation failed. Please try again.");}
    finally {if (active.current) setBusy(false);}
  };
  return <dialog ref={dialog} className="campaign-dialog" aria-labelledby="campaign-detail-title" onCancel={event => {event.preventDefault(); if (!busy) onClose();}}>
    <div className="dialog-heading"><span className={`status status-${campaign.status}`}><i />{campaignStatus(campaign)}</span><button type="button" className="icon-button" aria-label="Close notification details" disabled={busy} onClick={onClose}><Icon name="close" /></button></div>
    <span className="eyebrow">NOTIFICATION DETAILS</span><h2 id="campaign-detail-title">{campaign.title}</h2><p className="detail-body">{campaign.body}</p>{campaign.imageUrl && <img className="detail-image" src={campaign.imageUrl} referrerPolicy="no-referrer" alt="Notification image" />}
    <dl className="detail-meta"><div><dt>Audience</dt><dd>{platformLabel(campaign.target)}</dd></div><div><dt>Send time</dt><dd>{formatInstant(campaign.sendAt, {year: "numeric"})}<small>{operatorTimeZone}</small></dd></div><div><dt>Created</dt><dd>{formatInstant(campaign.createdAt, {year: "numeric"})}</dd></div></dl>
    <div className="outcome-grid">{[
      ["Accepted by push service", campaign.counts.accepted],
      ["Failed", campaign.counts.failed],
      ["Uncertain", campaign.counts.uncertain],
      ["Skipped", campaign.counts.skipped],
    ].map(([label, count]) => <div key={label}><strong>{count?.toLocaleString()}</strong><span>{label}</span></div>)}</div>
    <p className="field-hint">Accepted does not confirm display on a device. An uncertain result means the service could not confirm acceptance and will not resend that attempt automatically.</p>
    {error && <p className="inline-message error-message" role="alert">{error}</p>}
    {(campaign.status === "queued" || campaign.status === "sending") && <div className="cancel-section">{confirming ? <>
      <strong>Cancel this notification?</strong><p>Pending pushes will stop. Pushes already accepted by a service cannot be recalled.</p>
      <div className="dialog-actions"><button type="button" className="button-secondary" disabled={busy} onClick={() => setConfirming(false)}>Keep notification</button><button type="button" className="button-danger" disabled={busy} onClick={() => {void cancel();}}>{busy ? "Cancelling…" : "Yes, cancel notification"}</button></div>
    </> : <button type="button" className="text-danger" onClick={() => setConfirming(true)}>Cancel notification</button>}</div>}
  </dialog>;
}
