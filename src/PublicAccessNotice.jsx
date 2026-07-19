import { useEffect, useId, useRef, useState } from "react";
import {
  PUBLIC_ACCESS_RESTRICTION_MESSAGE,
  PUBLIC_ACCESS_RESTRICTION_TITLE,
  RESTRICTION_NOTICE_BYPASS_PARAM,
  shouldBypassRepeatedPublicNotice,
  VERIFICATION_NOTICE_MESSAGE,
  VERIFICATION_NOTICE_TITLE,
  WORKSPACE_PRE_RELEASE_MESSAGE,
  WORKSPACE_PRE_RELEASE_TITLE,
} from "../shared/service-restriction.js";

const PUBLIC_NOTICE = {
  title: PUBLIC_ACCESS_RESTRICTION_TITLE,
  message: PUBLIC_ACCESS_RESTRICTION_MESSAGE,
  status: "Pre-release",
  actionLabel: "Acknowledge and continue",
  rows: [
    { label: "Main workspace and archives", value: "Restricted", tone: "restricted" },
    { label: "This public page", value: "Available", tone: "available" },
  ],
};

const WORKSPACE_NOTICE = {
  title: WORKSPACE_PRE_RELEASE_TITLE,
  message: WORKSPACE_PRE_RELEASE_MESSAGE,
  status: "Authorised access",
  actionLabel: "Acknowledge and enter workspace",
  rows: [
    { label: "Full workspace", value: "Available", tone: "available" },
    { label: "Archive services", value: "Viewing and creation available", tone: "available" },
  ],
};

const VERIFICATION_NOTICE = {
  title: VERIFICATION_NOTICE_TITLE,
  message: VERIFICATION_NOTICE_MESSAGE,
  status: "Public verification",
  actionLabel: "Continue to verification",
  rows: [
    { label: "Announcement verification", value: "Available", tone: "available" },
    { label: "Sign-in", value: "Not required", tone: "available" },
  ],
};

export function PublicAccessNotice({ children, purpose = "general" }) {
  const [skipNotice] = useState(() => shouldBypassRepeatedPublicNotice(window.location.search));

  useEffect(() => {
    if (!skipNotice) return;
    const url = new URL(window.location.href);
    url.searchParams.delete(RESTRICTION_NOTICE_BYPASS_PARAM);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [skipNotice]);

  if (skipNotice) return children;
  const notice = purpose === "verification" ? VERIFICATION_NOTICE : PUBLIC_NOTICE;
  return <ServiceNotice notice={notice}>{children}</ServiceNotice>;
}

export function WorkspaceAccessNotice({ children }) {
  return <ServiceNotice notice={WORKSPACE_NOTICE}>{children}</ServiceNotice>;
}

function ServiceNotice({ children, notice }) {
  const [open, setOpen] = useState(true);
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }

      if (event.key === "Tab" && dialogRef.current) {
        event.preventDefault();
        closeButtonRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [open]);

  return (
    <>
      <div aria-hidden={open ? "true" : undefined}>{children}</div>
      {open && (
        <div
          className="public-restriction-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            ref={dialogRef}
            className="public-restriction-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={messageId}
          >
            <header className="public-restriction-masthead">
              <div className="public-restriction-identity">
                <span>Student representative service</span>
                <strong>Department of Chemistry Student Representatives</strong>
              </div>
              <div className="public-restriction-status">
                <span>Service status</span>
                <strong>{notice.status}</strong>
              </div>
            </header>

            <div className="public-restriction-body">
              <p className="public-restriction-kicker">Pre-release service notice</p>
              <h2 id={titleId}>{notice.title}</h2>
              <p id={messageId} className="public-restriction-lead">{notice.message}</p>

              <dl className="public-restriction-position" aria-label="Current service access">
                {notice.rows.map((row) => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd className={`is-${row.tone}`}>{row.value}</dd>
                  </div>
                ))}
              </dl>

              <button ref={closeButtonRef} type="button" onClick={() => setOpen(false)}>
                {notice.actionLabel}
              </button>
            </div>

            <footer className="public-restriction-footer">
              <strong>Manchester Chemistry Representative Mail Studio</strong>
              <span>Pre-release access</span>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
