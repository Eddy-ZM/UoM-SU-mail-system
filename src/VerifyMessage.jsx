import { useEffect, useRef, useState } from "react";

export function VerifyMessage() {
  const [messageNumber, setMessageNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [result, setResult] = useState({ status: "idle" });
  const verifyButtonRef = useRef(null);
  const resultIsOpen = ["valid", "invalid", "unavailable"].includes(result.status);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Verify an announcement | Manchester Chemistry Student Representatives";
    return () => { document.title = previousTitle; };
  }, []);

  useEffect(() => {
    if (!resultIsOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setResult({ status: "idle" });
        window.requestAnimationFrame(() => verifyButtonRef.current?.focus());
      }
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [resultIsOpen]);

  const dismissResult = () => {
    setResult({ status: "idle" });
    window.requestAnimationFrame(() => verifyButtonRef.current?.focus());
  };

  const submit = async (event) => {
    event.preventDefault();
    setResult({ status: "checking" });
    try {
      const response = await fetch("/api/verification", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ messageNumber, verificationCode }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error("unavailable");
      setResult(payload.valid === true
        ? { status: "valid", subject: payload.subject, firstArchivedAt: payload.firstArchivedAt }
        : { status: "invalid" });
    } catch {
      setResult({ status: "unavailable" });
    }
  };

  return (
    <main className="verify-page">
      <article className="verify-shell" inert={resultIsOpen ? true : undefined}>
        <header className="verify-masthead">
          <a className="verify-university-brand" href="https://www.manchester.ac.uk/" aria-label="The University of Manchester website">
            <img
              src="https://assets.manchester.ac.uk/logos/hi-res/TAB_UNI_MAIN_logo/White_backgrounds/TAB_col_white_background.png"
              alt="The University of Manchester"
              decoding="async"
            />
          </a>
          <div className="verify-department">
            <span>Department of Chemistry</span>
            <strong>Student Representatives</strong>
          </div>
        </header>

        <div className="verify-service-strip">
          <span>Student Representative Mail System</span>
          <strong>Public verification service</strong>
        </div>

        <div className="verify-layout">
          <section className="verify-primary" aria-labelledby="verify-title">
            <p className="verify-kicker">ANNOUNCEMENT AUTHENTICITY CHECK</p>
            <h1 id="verify-title">Verify an announcement</h1>
            <p className="verify-lead">Use the two identifiers printed in the purple footer of the email to confirm that it matches the Student Representatives&apos; immutable archive.</p>

            <form className="verify-form" onSubmit={submit}>
              <div className="verify-field">
                <label htmlFor="verify-number">Message number</label>
                <span id="verify-number-help">Begins with CHEM-SR- followed by eight characters.</span>
                <input
                  id="verify-number"
                  value={messageNumber}
                  onChange={(event) => setMessageNumber(event.target.value.toUpperCase())}
                  placeholder="CHEM-SR-A1B2C3D4"
                  aria-describedby="verify-number-help"
                  autoComplete="off"
                  spellCheck="false"
                  maxLength="16"
                  required
                />
              </div>

              <div className="verify-field">
                <label htmlFor="verify-code">Verification code</label>
                <span id="verify-code-help">Four groups of four characters separated by hyphens.</span>
                <input
                  id="verify-code"
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value.toUpperCase())}
                  placeholder="1234-ABCD-5678-EF90"
                  aria-describedby="verify-code-help"
                  autoComplete="off"
                  spellCheck="false"
                  maxLength="19"
                  required
                />
              </div>

              <button ref={verifyButtonRef} type="submit" disabled={result.status === "checking"}>{result.status === "checking" ? "Checking archive..." : "Verify announcement"}</button>
            </form>
          </section>

          <aside className="verify-guidance" aria-labelledby="verify-guidance-title">
            <p>ABOUT THIS CHECK</p>
            <h2 id="verify-guidance-title">Confirm a message before you act</h2>
            <p>The check compares only the two identifiers you enter. A valid result displays the archived email title, but never the email body or the representative who archived it.</p>
            <ol>
              <li><span>1</span><div><strong>Find both identifiers</strong><small>They appear together in the purple email footer.</small></div></li>
              <li><span>2</span><div><strong>Enter them exactly</strong><small>Letters are not case-sensitive.</small></div></li>
              <li><span>3</span><div><strong>Review the result</strong><small>Only proceed when the announcement is verified.</small></div></li>
            </ol>
            <dl>
              <div><dt>Service owner</dt><dd>Department of Chemistry Student Representatives</dd></div>
              <div><dt>Record type</dt><dd>Immutable email archive</dd></div>
              <div><dt>Information returned</dt><dd>Match status, email title and first archive time</dd></div>
            </dl>
          </aside>
        </div>

        <footer className="verify-footer">
          <div>
            <strong>University of Manchester Student Representative Mail System</strong>
            <span>Department of Chemistry &middot; Student Representatives Team</span>
          </div>
          <nav aria-label="Verification service information">
            <a href="/agreement/privacy-notice/">Privacy Notice</a>
            <a href="mailto:rongzhi.wu@student.manchester.ac.uk">Contact the team</a>
          </nav>
          <p>&copy; {new Date().getFullYear()} University of Manchester Student Representatives Team &middot; Technical support provided by Ziwen M.</p>
        </footer>
      </article>
      {resultIsOpen && (
        <div className="verify-result-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && dismissResult()}>
          <section className={`verify-result-dialog ${result.status}`} role="dialog" aria-modal="true" aria-labelledby="verification-result-title" aria-describedby="verification-result-description">
            <p className="verify-result-kicker">VERIFICATION RESULT</p>
            {result.status === "valid" && (
              <>
                <span className="verify-result-mark" aria-hidden="true">&#10003;</span>
                <h2 id="verification-result-title">Announcement verified</h2>
                <p id="verification-result-description">The message number and verification code match an immutable Student Representatives archive.</p>
                <dl className="verify-result-details">
                  <div className="verify-result-subject"><dt>Email title</dt><dd>{result.subject || "Untitled announcement"}</dd></div>
                  <div><dt>Message number</dt><dd>{messageNumber}</dd></div>
                  {result.firstArchivedAt && <div><dt>First archived</dt><dd>{new Date(result.firstArchivedAt).toLocaleString("en-GB")}</dd></div>}
                </dl>
              </>
            )}
            {result.status === "invalid" && (
              <>
                <span className="verify-result-mark" aria-hidden="true">!</span>
                <h2 id="verification-result-title">No matching archive found</h2>
                <p id="verification-result-description">Check both identifiers carefully. If they are correct, contact a Student Representative before following links or providing information.</p>
              </>
            )}
            {result.status === "unavailable" && (
              <>
                <span className="verify-result-mark" aria-hidden="true">!</span>
                <h2 id="verification-result-title">Verification service unavailable</h2>
                <p id="verification-result-description">Please try again later or contact a Student Representative for confirmation.</p>
              </>
            )}
            <button type="button" onClick={dismissResult} autoFocus>Close</button>
          </section>
        </div>
      )}
    </main>
  );
}
