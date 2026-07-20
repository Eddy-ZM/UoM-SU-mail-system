import { useEffect, useRef, useState } from "react";
import "./report-issue.css";

const INITIAL_FORM = {
  category: "",
  summary: "",
  details: "",
  desiredOutcome: "",
  studyStage: "",
  courseContext: "",
  impact: "",
  contactPreference: "anonymous",
  contactEmail: "",
  privacyAccepted: false,
  website: "",
};

function ErrorMessage({ id, children }) {
  if (!children) return null;
  return <span className="report-field-error" id={id}>{children}</span>;
}

export function ReportIssue() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [status, setStatus] = useState({ kind: "idle" });
  const startedAt = useRef(Date.now());
  const formHeadingRef = useRef(null);
  const successRef = useRef(null);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Report an issue | Manchester Chemistry Student Representatives";
    return () => { document.title = previousTitle; };
  }, []);

  useEffect(() => {
    if (status.kind !== "success") return;
    window.requestAnimationFrame(() => {
      successRef.current?.focus({ preventScroll: true });
      successRef.current?.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    });
  }, [status.kind]);

  const update = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "contactPreference" && value === "anonymous" ? { contactEmail: "" } : {}),
    }));
    if (status.kind === "error") setStatus({ kind: "idle" });
  };

  const submit = async (event) => {
    event.preventDefault();
    setStatus({ kind: "submitting" });

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ ...form, startedAt: startedAt.current }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || "We could not submit your report. Please try again.");
      }
      setStatus({ kind: "success", reference: payload.reference });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "We could not submit your report. Please try again.",
      });
    }
  };

  const startAnother = () => {
    setForm(INITIAL_FORM);
    startedAt.current = Date.now();
    setStatus({ kind: "idle" });
    window.requestAnimationFrame(() => formHeadingRef.current?.focus());
  };

  const contactRequired = form.contactPreference === "contact";
  const detailsHelp = status.kind === "error" ? "report-details-help report-form-error" : "report-details-help";

  return (
    <main className="report-page">
      <article className="report-shell">
        <header className="report-masthead">
          <div className="report-text-identity" aria-label="Department of Chemistry Student Representatives">
            <span>Student representative service</span>
            <strong>Department of Chemistry Student Representatives</strong>
          </div>
          <div className="report-department">
            <span>Public service</span>
            <strong>Student issue reporting</strong>
          </div>
        </header>

        <div className="report-service-strip">
          <span>University of Manchester Student Representative Mail System</span>
          <strong>Confidential reporting route</strong>
        </div>

        <div className="report-intro">
          <p className="report-kicker">STUDENT VOICE · OPEN AT ANY TIME</p>
          <h1>Tell us what needs attention.</h1>
          <p className="report-lead">
            Report a concern, recurring problem or practical barrier affecting your Chemistry experience. You may stay
            anonymous or ask a Student Representative to contact you.
          </p>
          <dl className="report-service-facts" aria-label="Reporting service information">
            <div><dt>Who can report</dt><dd>Any Chemistry student</dd></div>
            <div><dt>Contact details</dt><dd>Optional</dd></div>
            <div><dt>Submission access</dt><dd>Available online at any time</dd></div>
          </dl>
        </div>

        <div className="report-layout">
          <section className="report-primary" aria-labelledby="report-form-title">
            {status.kind === "success" ? (
              <div ref={successRef} className="report-success" role="status" aria-live="polite" tabIndex="-1">
                <p className="report-section-kicker">REPORT RECEIVED</p>
                <h2>Thank you for speaking up.</h2>
                <p>Your report has been recorded for the Student Representatives Team.</p>
                <dl>
                  <div><dt>Reference</dt><dd>{status.reference}</dd></div>
                  <div><dt>Follow-up</dt><dd>{contactRequired ? "Requested" : "No contact requested"}</dd></div>
                </dl>
                <p className="report-success-note">
                  Keep the reference for your records. This form is not monitored continuously and the reference cannot
                  be used to track an anonymous report online.
                </p>
                <button type="button" onClick={startAnother}>Submit another report</button>
              </div>
            ) : (
              <>
                <div className="report-section-heading">
                  <p className="report-section-kicker">REPORT DETAILS</p>
                  <h2 ref={formHeadingRef} id="report-form-title" tabIndex="-1">What would you like us to know?</h2>
                  <p>Required fields are marked. Please avoid names, student numbers or sensitive information unless they are essential.</p>
                </div>

                <form className="report-form" onSubmit={submit}>
                  <div className="report-field">
                    <label htmlFor="report-category">Type of issue <span aria-hidden="true">*</span></label>
                    <select id="report-category" value={form.category} onChange={(event) => update("category", event.target.value)} required>
                      <option value="">Choose one</option>
                      <option value="teaching">Teaching or course delivery</option>
                      <option value="assessment">Assessment or feedback</option>
                      <option value="laboratory">Laboratory teaching or safety</option>
                      <option value="facilities">Facilities, rooms or equipment</option>
                      <option value="accessibility">Accessibility or inclusion</option>
                      <option value="student-support">Student support or wellbeing</option>
                      <option value="conduct">Respect, conduct or community</option>
                      <option value="other">Something else</option>
                    </select>
                  </div>

                  <div className="report-field">
                    <label htmlFor="report-summary">Short summary <span aria-hidden="true">*</span></label>
                    <span id="report-summary-help">A clear headline helps us route the issue quickly.</span>
                    <input
                      id="report-summary"
                      value={form.summary}
                      onChange={(event) => update("summary", event.target.value)}
                      aria-describedby="report-summary-help"
                      maxLength="120"
                      placeholder="For example: Not enough time to move between two teaching rooms"
                      required
                    />
                    <small>{form.summary.length}/120</small>
                  </div>

                  <div className="report-field">
                    <label htmlFor="report-details">What happened? <span aria-hidden="true">*</span></label>
                    <span id="report-details-help">Describe the issue, when it occurs and who or what it affects. Do not include another person&apos;s private information.</span>
                    <textarea
                      id="report-details"
                      value={form.details}
                      onChange={(event) => update("details", event.target.value)}
                      aria-describedby={detailsHelp}
                      minLength="20"
                      maxLength="3000"
                      rows="8"
                      required
                    />
                    <small>{form.details.length}/3000</small>
                  </div>

                  <div className="report-field">
                    <label htmlFor="report-outcome">What would improve the situation?</label>
                    <span id="report-outcome-help">Optional. Tell us what a useful response or change would look like.</span>
                    <textarea
                      id="report-outcome"
                      value={form.desiredOutcome}
                      onChange={(event) => update("desiredOutcome", event.target.value)}
                      aria-describedby="report-outcome-help"
                      maxLength="1200"
                      rows="4"
                    />
                    <small>{form.desiredOutcome.length}/1200</small>
                  </div>

                  <fieldset className="report-fieldset">
                    <legend>Context</legend>
                    <div className="report-field-grid">
                      <div className="report-field">
                        <label htmlFor="report-stage">Study stage</label>
                        <select id="report-stage" value={form.studyStage} onChange={(event) => update("studyStage", event.target.value)}>
                          <option value="">Prefer not to say</option>
                          <option value="undergraduate">Undergraduate</option>
                          <option value="postgraduate-taught">Postgraduate taught</option>
                          <option value="postgraduate-research">Postgraduate research</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div className="report-field">
                        <label htmlFor="report-context">Course unit or location</label>
                        <input
                          id="report-context"
                          value={form.courseContext}
                          onChange={(event) => update("courseContext", event.target.value)}
                          maxLength="120"
                          placeholder="Optional"
                        />
                      </div>
                    </div>
                  </fieldset>

                  <fieldset className="report-fieldset">
                    <legend>How much is this affecting students? <span aria-hidden="true">*</span></legend>
                    <div className="report-choice-grid">
                      {[
                        ["limited", "Limited", "An inconvenience or isolated issue"],
                        ["moderate", "Moderate", "A repeated problem or clear barrier"],
                        ["significant", "Significant", "A serious or widespread impact"],
                      ].map(([value, label, description]) => (
                        <label className="report-choice" key={value}>
                          <input type="radio" name="impact" value={value} checked={form.impact === value} onChange={(event) => update("impact", event.target.value)} required />
                          <span><strong>{label}</strong><small>{description}</small></span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset className="report-fieldset">
                    <legend>Would you like us to contact you? <span aria-hidden="true">*</span></legend>
                    <div className="report-contact-options">
                      <label className="report-choice">
                        <input type="radio" name="contactPreference" value="anonymous" checked={!contactRequired} onChange={(event) => update("contactPreference", event.target.value)} />
                        <span><strong>No — keep this report anonymous</strong><small>No contact details will be stored with the report.</small></span>
                      </label>
                      <label className="report-choice">
                        <input type="radio" name="contactPreference" value="contact" checked={contactRequired} onChange={(event) => update("contactPreference", event.target.value)} />
                        <span><strong>Yes — a representative may contact me</strong><small>Your email is used only to follow up this report.</small></span>
                      </label>
                    </div>
                    {contactRequired && (
                      <div className="report-field report-contact-email">
                        <label htmlFor="report-email">Email address <span aria-hidden="true">*</span></label>
                        <input
                          id="report-email"
                          type="email"
                          value={form.contactEmail}
                          onChange={(event) => update("contactEmail", event.target.value)}
                          autoComplete="email"
                          maxLength="254"
                          required
                        />
                      </div>
                    )}
                  </fieldset>

                  <label className="report-confirmation">
                    <input
                      type="checkbox"
                      checked={form.privacyAccepted}
                      onChange={(event) => update("privacyAccepted", event.target.checked)}
                      required
                    />
                    <span>I have read the <a href="/agreement/privacy-notice/" target="_blank" rel="noreferrer">Privacy Notice</a> and understand how this submission will be handled.</span>
                  </label>

                  <div className="report-honeypot" aria-hidden="true">
                    <label htmlFor="report-website">Website</label>
                    <input id="report-website" tabIndex="-1" autoComplete="off" value={form.website} onChange={(event) => update("website", event.target.value)} />
                  </div>

                  <ErrorMessage id="report-form-error">{status.kind === "error" ? status.message : ""}</ErrorMessage>

                  <button type="submit" disabled={status.kind === "submitting"}>
                    {status.kind === "submitting" ? "Submitting report..." : "Submit report"}
                  </button>
                  <p className="report-submit-note">You will receive an on-screen reference. This form does not save a draft on this device.</p>
                </form>
              </>
            )}
          </section>

          <aside className="report-guidance" aria-labelledby="report-guidance-title">
            <section className="report-urgent">
              <p>NEED URGENT HELP?</p>
              <h2 id="report-guidance-title">This is not an emergency service.</h2>
              <p>Reports are not monitored continuously. For an emergency or immediate risk, use the University&apos;s emergency support information.</p>
              <a href="https://www.studentsupport.manchester.ac.uk/taking-care/emergency/" target="_blank" rel="noreferrer">Open emergency support information</a>
            </section>

            <section className="report-guidance-section">
              <p>SPECIALIST REPORTING</p>
              <h2>Harassment, discrimination or safeguarding</h2>
              <p>The University&apos;s Report + Support service offers anonymous reporting and contact with a trained advisor.</p>
              <a href="https://www.reportandsupport.manchester.ac.uk/" target="_blank" rel="noreferrer">Open Report + Support</a>
            </section>

            <section className="report-guidance-section">
              <p>WHAT HAPPENS NEXT</p>
              <ol>
                <li><span>1</span><div><strong>We record the issue</strong><small>Your on-screen reference confirms submission.</small></div></li>
                <li><span>2</span><div><strong>Representatives review it</strong><small>We group recurring themes and decide the appropriate route.</small></div></li>
                <li><span>3</span><div><strong>We follow up when requested</strong><small>Anonymous reports will not receive an individual reply.</small></div></li>
              </ol>
            </section>
          </aside>
        </div>

        <footer className="report-footer">
          <div>
            <strong>University of Manchester Student Representative Mail System</strong>
            <span>Department of Chemistry &middot; Student Representatives Team</span>
          </div>
          <nav aria-label="Reporting service information">
            <a href="/verify/">Verify an announcement</a>
            <a href="/agreement/privacy-notice/">Privacy Notice</a>
          </nav>
          <p>&copy; {new Date().getFullYear()} University of Manchester Student Representatives Team &middot; Technical support provided by Ziwen M.</p>
        </footer>
      </article>
    </main>
  );
}
