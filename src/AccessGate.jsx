import { useCallback, useEffect, useState } from "react";

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
  const title = isBusy
    ? access.status === "redirecting" ? "Opening ChemVault login" : "Verifying access"
    : access.status === "forbidden" ? "Access denied" : "Authentication unavailable";
  const message = isBusy
    ? "ChemVault User System is checking your account and mail-editor permission."
    : access.status === "forbidden"
      ? "Your account is signed in, but it does not have permission to use this editor. Please contact a User System administrator."
      : "The editor remains closed because ChemVault User System could not verify your access.";

  return (
    <main className="access-gate" aria-busy={isBusy ? "true" : "false"}>
      <section className="access-gate-card" aria-live="polite">
        <div className="access-gate-kicker">The University of Manchester</div>
        <div className={`access-gate-mark${isBusy ? " is-busy" : ""}`} aria-hidden="true">
          <span />
        </div>
        <h1>{title}</h1>
        <p>{message}</p>
        {!isBusy && (
          <div className="access-gate-actions">
            <button type="button" onClick={verifyAccess}>Try again</button>
            <a href="https://user.chemvault.science/">Open User System</a>
          </div>
        )}
      </section>
    </main>
  );
}
