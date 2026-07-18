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
      <span>Access managed by ChemVault User System</span>
    </footer>
  );
}

export function WorkspaceChooser({
  user,
  onCreateEmail,
  onSearchArchive,
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
          <p>Create a publication-ready Manchester email or find a message your team has saved before.</p>
        </div>

        <div className="workspace-chooser__actions" aria-label="Mail workspace actions">
          <button className="workspace-action workspace-action--primary" type="button" onClick={onCreateEmail}>
            <span className="workspace-action__copy">
              <strong>Create a new email</strong>
              <small>Start with an approved announcement template.</small>
            </span>
          </button>

          <button className="workspace-action" type="button" onClick={onSearchArchive}>
            <span className="workspace-action__copy">
              <strong>Search the archive</strong>
              <small>Review immutable backups and verification records.</small>
            </span>
          </button>
        </div>
      </section>

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
  onCreateEmail,
  onOpenArchived,
  onSearchArchive,
  onLogout,
  isLoggingOut = false,
}) {
  return (
    <main className="workspace-chooser archive-session">
      <WorkspaceHeader user={user} onLogout={onLogout} isLoggingOut={isLoggingOut} />
      <section className="archive-session__content" aria-labelledby="archive-session-title">
        <p className="archive-session__eyebrow">Immutable backup created</p>
        <h1 id="archive-session-title">Email archived. Editor closed.</h1>
        <p>This email cannot be edited again. Authorised team members can reopen its read-only copy and repeat copy or download operations for 24 hours from its first archive time.</p>
        <dl className="archive-session__receipt">
          <div><dt>Message number</dt><dd><code>{receipt.messageNumber}</code></dd></div>
          <div><dt>Verification code</dt><dd><code>{receipt.verificationCode}</code></dd></div>
          <div><dt>Archived</dt><dd>{new Date(receipt.createdAt).toLocaleString("en-GB")}</dd></div>
        </dl>
        <div className="archive-session__actions">
          <button className="archive-session__primary" type="button" onClick={onOpenArchived}>Open read-only copy</button>
          <button type="button" onClick={onCreateEmail}>Create another email</button>
          <button type="button" onClick={onSearchArchive}>Search the archive</button>
        </div>
      </section>
      <WorkspaceFooter />
    </main>
  );
}
