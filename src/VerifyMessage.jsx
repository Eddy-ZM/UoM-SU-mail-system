import { useEffect, useState } from "react";

export function VerifyMessage() {
  const [messageNumber, setMessageNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [result, setResult] = useState({ status: "idle" });

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Verify an announcement | Manchester Chemistry Student Representatives";
    return () => { document.title = previousTitle; };
  }, []);

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
        ? { status: "valid", firstArchivedAt: payload.firstArchivedAt }
        : { status: "invalid" });
    } catch {
      setResult({ status: "unavailable" });
    }
  };

  return (
    <main className="verify-page">
      <article className="verify-shell">
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

              <button type="submit" disabled={result.status === "checking"}>{result.status === "checking" ? "Checking archive..." : "Verify announcement"}</button>
            </form>

            <div className={`verify-result ${result.status}`} aria-live="polite">
              {result.status === "valid" && <><strong>Announcement verified</strong><span>The message number and verification code match an immutable Student Representatives archive.</span>{result.firstArchivedAt && <small>First archived: {new Date(result.firstArchivedAt).toLocaleString("en-GB")}</small>}</>}
              {result.status === "invalid" && <><strong>No matching archive found</strong><span>Check both identifiers carefully. If they are correct, contact a Student Representative before following links or providing information.</span></>}
              {result.status === "unavailable" && <><strong>Verification service unavailable</strong><span>Please try again later or contact a Student Representative for confirmation.</span></>}
            </div>
          </section>

          <aside className="verify-guidance" aria-labelledby="verify-guidance-title">
            <p>ABOUT THIS CHECK</p>
            <h2 id="verify-guidance-title">Confirm a message before you act</h2>
            <p>The check compares only the two identifiers you enter. It does not display the email, its contents or the representative who archived it.</p>
            <ol>
              <li><span>1</span><div><strong>Find both identifiers</strong><small>They appear together in the purple email footer.</small></div></li>
              <li><span>2</span><div><strong>Enter them exactly</strong><small>Letters are not case-sensitive.</small></div></li>
              <li><span>3</span><div><strong>Review the result</strong><small>Only proceed when the announcement is verified.</small></div></li>
            </ol>
            <dl>
              <div><dt>Service owner</dt><dd>Department of Chemistry Student Representatives</dd></div>
              <div><dt>Record type</dt><dd>Immutable email archive</dd></div>
              <div><dt>Information returned</dt><dd>Match status and first archive time only</dd></div>
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
    </main>
  );
}
