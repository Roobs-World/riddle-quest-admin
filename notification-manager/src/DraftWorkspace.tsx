import {useState} from "react";
import {Composer} from "./Composer";
import {Icon} from "./Icons";

export function DraftWorkspace({onBack}: {onBack(): void}) {
  const [revision, setRevision] = useState(0);
  return <div className="application draft-workspace">
    <aside className="sidebar"><a className="brand" href="#main"><span className="app-mark"><Icon name="bell" /></span><span>riddle quest<small>NOTIFICATION STUDIO</small></span></a><p>Local drafts</p><p>Compose and plan notifications on this browser.</p></aside>
    <div className="workspace"><header className="topbar"><button type="button" className="text-button" onClick={onBack}>Back to sign-in</button><span className="subtle-pill">Local drafts only</span></header>
      <main id="main" className="main-content"><div className="page-heading"><div><span className="eyebrow">LOCAL WORKSPACE</span><h1>Prepare your notifications.</h1><p>Drafts stay on this browser. Saving a date does not schedule delivery.</p></div></div>
        <div className="workspace-error" role="status">Sending, delivery history and cloud image uploads become available after the service is connected. You can use a public image URL in your draft.</div>
        <Composer key={revision} draftOwner="local" localOnly configuration={{platforms: [], pushOnly: true, firebaseAudience: {status: "unconfigured"}}} campaigns={[]} scheduleRequest={null}
          onCreate={async () => {throw new Error("Connect the service before sending notifications.");}}
          onUpload={async () => {throw new Error("Connect the service before uploading images.");}} />
        <p className="field-hint">Use Export draft to keep a portable copy. Browser data can be cleared by the browser or its user.</p>
        <button type="button" className="text-button" onClick={() => setRevision(value => value + 1)}>Reload saved drafts</button>
      </main>
    </div>
  </div>;
}
