import { useEffect, useRef } from "react";
import "./workspace-chooser.css";

function displayNameFor(user) {
  const name = typeof user?.name === "string" ? user.name.trim() : "";
  if (name) return name;
  const email = typeof user?.email === "string" ? user.email.trim() : "";
  return email ? email.split("@")[0] : "ChemVault user";
}

function initialsFor(user) {
  const displayName = displayNameFor(user);
  const initials = displayName
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return initials || "CV";
}

function formatDraftDate(timestamp) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function WorkspaceHeader({ user, onLogout, logoutSlot = null, isLoggingOut = false }) {
  const displayName = displayNameFor(user);
  const email = typeof user?.email === "string" ? user.email.trim() : "";

  return (
    <header className="workspace-chooser__header">
      <div className="workspace-chooser__brand">
        <span className="workspace-chooser__kicker">The University of Manchester</span>
        <span className="workspace-chooser__product">Chemistry Representative Mail Studio</span>
      </div>

      <div className="workspace-chooser__account" aria-label="Current account">
        <span className="workspace-chooser__avatar" aria-hidden="true">{initialsFor(user)}</span>
        <span className="workspace-chooser__identity">
          <span>Signed in as</span>
          <strong>{displayName}</strong>
          {email && <small>{email}</small>}
        </span>
        {logoutSlot || (onLogout && (
          <button
            className="workspace-chooser__logout"
            type="button"
            onClick={onLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? "Signing out…" : "Sign out"}
          </button>
        ))}
      </div>
    </header>
  );
}

function WorkspaceFooter() {
  return (
    <footer className="workspace-chooser__footer">
      <span>Department of Chemistry · Student Representatives</span>
      <span>Access managed by the University of Manchester, Department of Chemistry Student Representative Team</span>
    </footer>
  );
}

export function MobileEditorDialog({ open, onClose, hasDraft = false }) {
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    closeRef.current?.focus({ preventScroll: true });
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      previousFocus?.focus?.({ preventScroll: true });
    };
  }, [onClose, open]);

  if (!open) return null;
  return (
    <div className="mobile-editor-dialog" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="alertdialog" aria-modal="true" aria-labelledby="mobile-editor-dialog-title" aria-describedby="mobile-editor-dialog-description">
        <span className="mobile-editor-dialog__eyebrow">Desktop browser required</span>
        <h2 id="mobile-editor-dialog-title">Email editor requires a desktop browser</h2>
        <p id="mobile-editor-dialog-description">
          The visual email editor is disabled on mobile-sized screens to prevent an unstable editing session.
          {hasDraft ? " Your saved draft remains unchanged and can be continued from a desktop browser." : " Open this service on a desktop browser to create the email."}
        </p>
        <div className="mobile-editor-dialog__facts">
          <span>Available here</span>
          <strong>Archives, student reports and public services</strong>
        </div>
        <button ref={closeRef} type="button" onClick={onClose}>Understood</button>
      </section>
    </div>
  );
}

export function WorkspaceChooser({
  user,
  draft = null,
  onCreateEmail,
  onResumeDraft,
  onDeleteDraft,
  onSearchArchive,
  onOpenReportArchive,
  onOpenAuditLog,
  editorUnavailable = false,
  onLogout,
  logoutSlot = null,
  isLoggingOut = false,
  className = "",
}) {
  const rootClassName = ["workspace-chooser", className].filter(Boolean).join(" ");

  return (
    <main className={rootClassName}>
      <WorkspaceHeader user={user} onLogout={onLogout} logoutSlot={logoutSlot} isLoggingOut={isLoggingOut} />

      <section className="workspace-chooser__content" aria-labelledby="workspace-chooser-title">
        <div className="workspace-chooser__intro">
          <span className="workspace-chooser__eyebrow">Student Representatives workspace</span>
          <h1 id="workspace-chooser-title">What would you like to do?</h1>
          <p>Create a publication-ready Manchester email, review student submissions or find a message your team has saved before.</p>
        </div>

        {draft && (
          <section className="workspace-draft" aria-labelledby="workspace-draft-title">
            <div className="workspace-draft__copy">
              <span className="workspace-draft__eyebrow">Saved draft</span>
              <h2 id="workspace-draft-title">{draft.subject || "Untitled email"}</h2>
              <p>Stored only in this browser. Drafts expire automatically 7 days after their most recent save.</p>
              <dl>
                <div><dt>Last saved</dt><dd>{formatDraftDate(draft.updatedAt)}</dd></div>
                <div><dt>Expires</dt><dd>{formatDraftDate(draft.expiresAt)}</dd></div>
              </dl>
            </div>
            <div className="workspace-draft__actions">
              <button type="button" onClick={onResumeDraft}>Continue editing</button>
              <button type="button" onClick={onDeleteDraft}>Delete draft</button>
            </div>
          </section>
        )}

        <div className="workspace-chooser__actions" aria-label="Representative workspace actions">
          <button className="workspace-action workspace-action--primary" type="button" onClick={onCreateEmail}>
            <span className="workspace-action__copy">
              <strong>Create a new email</strong>
              <small>{editorUnavailable ? "Tap to review the desktop-browser requirement." : "Start with an approved announcement template."}</small>
            </span>
          </button>

          <button className="workspace-action" type="button" onClick={onSearchArchive}>
            <span className="workspace-action__copy">
              <strong>Search the archive</strong>
              <small>Review immutable backups and verification records.</small>
            </span>
          </button>

          <button className="workspace-action" type="button" onClick={onOpenReportArchive}>
            <span className="workspace-action__copy">
              <strong>Student reports</strong>
              <small>View submitted reports and follow-up requests.</small>
            </span>
          </button>

          {user?.capabilities?.auditLog && (
            <button className="workspace-action workspace-action--admin" type="button" onClick={onOpenAuditLog}>
              <span className="workspace-action__copy">
                <strong>System logs</strong>
                <small>Open the owner-only activity and session monitor.</small>
              </span>
            </button>
          )}
        </div>

        <section className="workspace-public" aria-labelledby="workspace-public-title">
          <div className="workspace-public__heading">
            <span id="workspace-public-title">Public resources</span>
            <p>Report an issue, verify an announcement or read how information is handled.</p>
          </div>
          <div className="workspace-public__links">
            <a href="/report/" target="_blank" rel="noreferrer">
              <span><strong>Report a student issue</strong><small>Share a concern anonymously or request follow-up.</small></span>
              <span aria-hidden="true">↗</span>
            </a>
            <a href="/verify/" target="_blank" rel="noreferrer">
              <span><strong>Verify an announcement</strong><small>Check a message number and verification code.</small></span>
              <span aria-hidden="true">↗</span>
            </a>
            <a href="/agreement/privacy-notice/" target="_blank" rel="noreferrer">
              <span><strong>Privacy Notice</strong><small>Read the formal privacy and Microsoft 365 Forms notice.</small></span>
              <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>
      </section>

      <WorkspaceFooter />
    </main>
  );
}

export function ArchiveWorkspace({
  user,
  children,
  onLogout,
  isLoggingOut = false,
}) {
  return (
    <main className="workspace-chooser archive-workspace">
      <WorkspaceHeader user={user} onLogout={onLogout} isLoggingOut={isLoggingOut} />
      <div className="archive-workspace__content">
        {children}
      </div>
      <WorkspaceFooter />
    </main>
  );
}

export function ArchiveProgress({ user, onLogout, isLoggingOut = false }) {
  return (
    <main className="workspace-chooser archive-session" aria-busy="true">
      <WorkspaceHeader user={user} onLogout={onLogout} isLoggingOut={isLoggingOut} />
      <section className="archive-session__content" aria-live="polite">
        <p className="archive-session__eyebrow">Creating immutable backup</p>
        <h1>Closing the editor securely</h1>
        <p>The draft is locked while the archive service records its final content and submitting account.</p>
      </section>
      <WorkspaceFooter />
    </main>
  );
}

export function ArchivedSession({
  user,
  receipt,
  outlookGraphState = "unavailable",
  onCreateOutlookDraft,
  onAutoDownloadOutlook,
  onDownloadOutlook,
  onCopyOutlook,
  onCreateEmail,
  onOpenArchived,
  onSearchArchive,
  onHome,
  onLogout,
  isLoggingOut = false,
}) {
  const outlookCopyReady = receipt.operation === "copy_outlook" && typeof onCopyOutlook === "function";
  const outlookDraftReady = receipt.operation === "copy_outlook" && typeof onDownloadOutlook === "function";
  const outlookGraphReady = outlookDraftReady && outlookGraphState === "available" && typeof onCreateOutlookDraft === "function";
  const outlookGraphChecking = outlookDraftReady && outlookGraphState === "checking";

  useEffect(() => {
    if (outlookDraftReady && outlookGraphState === "unavailable" && typeof onAutoDownloadOutlook === "function") onAutoDownloadOutlook();
  }, [onAutoDownloadOutlook, outlookDraftReady, outlookGraphState]);

  return (
    <main className="workspace-chooser archive-session">
      <WorkspaceHeader user={user} onLogout={onLogout} isLoggingOut={isLoggingOut} />
      <section className="archive-session__content" aria-labelledby="archive-session-title">
        <p className="archive-session__eyebrow">Immutable backup created</p>
        <h1 id="archive-session-title">
          {outlookGraphReady
            ? "Email archived. Ready for Outlook."
            : outlookGraphChecking
              ? "Email archived. Checking Outlook connection."
              : outlookDraftReady ? "Email archived. Outlook draft downloaded." : "Email archived. Editor closed."}
        </h1>
        <p>
          {outlookGraphReady
            ? "Create the draft directly in your Microsoft 365 Outlook mailbox. Outlook will open it with the subject and formatted message ready; add the recipient address, review and send."
            : outlookGraphChecking
              ? "The archived email is safe. The mail studio is checking whether direct Microsoft 365 draft creation is available."
              : outlookDraftReady
            ? "An editable .eml draft has been downloaded automatically. Open the file in Outlook, add the recipient address and review the message before sending."
            : "This email cannot be edited again. Authorised team members can reopen its read-only copy and repeat copy or download operations for 24 hours from its first archive time."}
        </p>
        <dl className="archive-session__receipt">
          <div className="archive-session__subject"><dt>Subject</dt><dd>{receipt.subject || "Archived email"}</dd></div>
          <div><dt>Message number</dt><dd><code>{receipt.messageNumber}</code></dd></div>
          <div><dt>Verification code</dt><dd><code>{receipt.verificationCode}</code></dd></div>
          <div><dt>Archived</dt><dd>{new Date(receipt.createdAt).toLocaleString("en-GB")}</dd></div>
        </dl>
        <div className="archive-session__actions">
          {outlookGraphReady && (
            <button className="archive-session__primary" type="button" onClick={onCreateOutlookDraft}>Create Outlook draft</button>
          )}
          {outlookDraftReady && (
            <button className={outlookGraphReady ? "" : "archive-session__primary"} type="button" onClick={onDownloadOutlook}>
              {outlookGraphReady ? "Download .eml backup" : "Download .eml again"}
            </button>
          )}
          {outlookCopyReady && (
            <button type="button" onClick={onCopyOutlook}>Copy to Outlook</button>
          )}
          <button className={outlookDraftReady ? "" : "archive-session__primary"} type="button" onClick={onOpenArchived}>Open read-only copy</button>
          <button type="button" onClick={onCreateEmail}>Create another email</button>
          <button type="button" onClick={onSearchArchive}>Search the archive</button>
          <button type="button" onClick={onHome}>Home</button>
        </div>
      </section>
      <WorkspaceFooter />
    </main>
  );
}
