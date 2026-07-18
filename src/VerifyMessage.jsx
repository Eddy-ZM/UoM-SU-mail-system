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
      <section className="verify-card">
        <p className="verify-kicker">DEPARTMENT OF CHEMISTRY &middot; STUDENT REPRESENTATIVES</p>
        <h1>Verify an announcement</h1>
        <p className="verify-lead">Enter the message number and the 16-character verification code printed in the purple footer of the email.</p>
        <form onSubmit={submit}>
          <label htmlFor="verify-number">Message number</label>
          <input id="verify-number" value={messageNumber} onChange={(event) => setMessageNumber(event.target.value.toUpperCase())} placeholder="CHEM-SR-A1B2C3D4" autoComplete="off" required />
          <label htmlFor="verify-code">Verification code</label>
          <input id="verify-code" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.toUpperCase())} placeholder="1234-ABCD-5678-EF90" autoComplete="off" required />
          <button type="submit" disabled={result.status === "checking"}>{result.status === "checking" ? "Checking..." : "Verify message"}</button>
        </form>
        <div className={`verify-result ${result.status}`} aria-live="polite">
          {result.status === "valid" && <><strong>Verified</strong><span>This message number and verification code match an immutable Team archive.</span>{result.firstArchivedAt && <small>First archived: {new Date(result.firstArchivedAt).toLocaleString("en-GB")}</small>}</>}
          {result.status === "invalid" && <><strong>Not verified</strong><span>The values do not match an archived announcement. Check both values or contact a Student Representative.</span></>}
          {result.status === "unavailable" && <><strong>Verification unavailable</strong><span>Please try again later or contact a Student Representative.</span></>}
        </div>
        <p className="verify-privacy">This public check returns only a match result and does not reveal the archived email or the representative who created it. <a href="/agreement/privacy-notice/">Privacy Notice</a></p>
      </section>
    </main>
  );
}
