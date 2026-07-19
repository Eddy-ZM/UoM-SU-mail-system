import { useEffect, useRef, useState } from "react";
import {
  PUBLIC_ACCESS_RESTRICTION_MESSAGE,
  PUBLIC_ACCESS_RESTRICTION_TITLE,
} from "../shared/service-restriction.js";

export function PublicAccessNotice({ children }) {
  const [open, setOpen] = useState(true);
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);

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
            aria-labelledby="public-restriction-title"
            aria-describedby="public-restriction-message"
          >
            <header className="public-restriction-masthead">
              <div className="public-restriction-identity">
                <span>Student representative service</span>
                <strong>Department of Chemistry Student Representatives</strong>
              </div>
              <div className="public-restriction-status">
                <span>Service status</span>
                <strong>Pre-release</strong>
              </div>
            </header>

            <div className="public-restriction-body">
              <p className="public-restriction-kicker">Pre-release service notice</p>
              <h2 id="public-restriction-title">{PUBLIC_ACCESS_RESTRICTION_TITLE}</h2>
              <p id="public-restriction-message" className="public-restriction-lead">
                {PUBLIC_ACCESS_RESTRICTION_MESSAGE}
              </p>

              <dl className="public-restriction-position" aria-label="Current service position">
                <div>
                  <dt>Main workspace and archives</dt>
                  <dd className="is-restricted">Restricted</dd>
                </div>
                <div>
                  <dt>This public page</dt>
                  <dd>Available</dd>
                </div>
              </dl>

              <button ref={closeButtonRef} type="button" onClick={() => setOpen(false)}>
                Acknowledge and continue
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
