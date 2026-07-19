import { useCallback, useEffect, useState } from "react";
import {
  ACCESS_RESTRICTION_MESSAGE,
  ACCESS_RESTRICTION_TITLE,
} from "../shared/service-restriction.js";

const INITIAL_STATE = { status: "checking", loginUrl: null, user: null };
const BACKGROUND_RECHECK_MS = 60_000;

export function AccessGate({ children }) {
  const [access, setAccess] = useState(INITIAL_STATE);

  const verifyAccess = useCallback(async ({ background = false } = {}) => {
    if (!background) setAccess(INITIAL_STATE);
    try {
      const response = await fetch("/api/access/status", {
        credentials: "same-origin",
        cache: "no-store",
        headers: { accept: "application/json" },
      });
      const payload = await response.json();

      if (response.ok && payload.allowed === true && payload.user) {
        setAccess({ status: "allowed", loginUrl: null, user: payload.user });
        return;
      }

      if (response.status === 401 && typeof payload.loginUrl === "string") {
        setAccess({ status: "redirecting", loginUrl: payload.loginUrl, user: null });
        window.location.replace(payload.loginUrl);
        return;
      }

      if (response.status === 403) {
        setAccess({ status: "forbidden", loginUrl: null, user: null });
        return;
      }

      setAccess({ status: "unavailable", loginUrl: null, user: null });
    } catch {
      setAccess({ status: "unavailable", loginUrl: null, user: null });
    }
  }, []);

  useEffect(() => {
    verifyAccess();

    const recheckWhenVisible = () => {
      if (document.visibilityState === "visible") void verifyAccess({ background: true });
    };
    const interval = window.setInterval(recheckWhenVisible, BACKGROUND_RECHECK_MS);
    document.addEventListener("visibilitychange", recheckWhenVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", recheckWhenVisible);
    };
  }, [verifyAccess]);

  if (access.status === "allowed") {
    return typeof children === "function" ? children(access.user) : children;
  }

  const isBusy = access.status === "checking" || access.status === "redirecting";
  const isForbidden = access.status === "forbidden";
  const title = isBusy
    ? access.status === "redirecting" ? "Opening ChemVault login" : "Verifying access"
    : isForbidden ? ACCESS_RESTRICTION_TITLE : "Authentication unavailable";
  const message = isBusy
    ? "Your signed-in account and service permission are being verified through ChemVault User System."
    : isForbidden
      ? ACCESS_RESTRICTION_MESSAGE
      : "The service remains closed because ChemVault User System could not confirm your access at this time.";

  return (
    <main className="access-gate" aria-busy={isBusy ? "true" : "false"}>
      <section className="access-gate-document" aria-live="polite">
        <header className="access-gate-masthead">
          <div className="access-gate-identity">
            <span>Student representative service</span>
            <strong>Department of Chemistry Student Representatives</strong>
          </div>
          <div className="access-gate-status">
            <span>Service status</span>
            <strong>{isForbidden ? "Pre-release access" : "Secure access check"}</strong>
          </div>
        </header>

        <div className="access-gate-service-strip">
          <span>Manchester Chemistry Representative Mail Studio</span>
          <strong>{isForbidden ? "Limited access" : "Identity verification"}</strong>
        </div>

        <div className="access-gate-body">
          <div className="access-gate-copy">
            <p className="access-gate-kicker">
              {isForbidden ? "Pre-release service notice" : "Secure access check"}
            </p>
            <h1>{title}</h1>
            <p className="access-gate-lead">{message}</p>
            {isBusy && (
              <div className="access-gate-progress" role="status">
                <span aria-hidden="true" />
                <p>{access.status === "redirecting" ? "Redirecting to sign in…" : "Checking your access…"}</p>
              </div>
            )}
          </div>

          {isForbidden && (
            <aside className="access-gate-position" aria-label="Current access position">
              <p>Current access position</p>
              <dl>
                <div>
                  <dt>Main workspace</dt>
                  <dd className="is-restricted">Restricted</dd>
                </div>
                <div>
                  <dt>Archive services</dt>
                  <dd>Viewing and creation unavailable</dd>
                </div>
                <div>
                  <dt>Public verification</dt>
                  <dd className="is-available">Available</dd>
                </div>
              </dl>
            </aside>
          )}

          {!isBusy && !isForbidden && (
            <aside className="access-gate-advisory">
              Access will remain closed until your account and permission can be verified securely.
            </aside>
          )}

          {!isBusy && (
            <div className="access-gate-actions">
              {isForbidden && <a className="is-primary" href="/verify/">Open public verification</a>}
              <button type="button" onClick={verifyAccess}>Check access again</button>
              <a href="https://user.chemvault.science/">Review account access</a>
            </div>
          )}
        </div>

        <footer className="access-gate-footer">
          <div>
            <strong>Manchester Chemistry Representative Mail Studio</strong>
            <span>Student representative communications service</span>
          </div>
          <a href="/agreement/privacy-notice/">Privacy notice</a>
        </footer>
      </section>
    </main>
  );
}
