import { useEffect } from "react";

const CONTACT_EMAIL = "rongzhi.wu@student.manchester.ac.uk";

export function DuplicateSubmission() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Questionnaire already submitted | Manchester Chemistry Student Representatives";
    return () => { document.title = previousTitle; };
  }, []);

  return (
    <main className="verify-page duplicate-submission-page">
      <article className="verify-shell">
        <header className="verify-masthead">
          <div className="verify-text-identity" aria-label="Department of Chemistry Student Representatives">
            <span aria-hidden="true">Student representative service</span>
            <strong>Department of Chemistry Student Representatives</strong>
          </div>
          <div className="verify-department">
            <span>Questionnaire status</span>
            <strong>Submission notice</strong>
          </div>
        </header>

        <div className="verify-service-strip">
          <span>Student Representative Mail System</span>
          <strong>Public questionnaire notice</strong>
        </div>

        <div className="verify-layout">
          <section className="verify-primary" aria-labelledby="duplicate-submission-title">
            <p className="verify-kicker">QUESTIONNAIRE SUBMISSION STATUS</p>
            <h1 id="duplicate-submission-title">This questionnaire has already been submitted</h1>
            <p className="verify-lead">
              A previous response has already been recorded for this questionnaire. You do not need to submit another response.
            </p>

            <dl className="duplicate-submission-status" aria-label="Submission status">
              <div><dt>Status</dt><dd>Previous response detected</dd></div>
              <div><dt>Next step</dt><dd>No further submission is required</dd></div>
            </dl>

            <p className="duplicate-submission-note">
              Visiting this page does not change or replace your earlier response. If you believe this notice is incorrect, or you need to update something you submitted, contact the Student Representatives Team.
            </p>

            <div className="duplicate-submission-actions">
              <a className="duplicate-submission-primary" href={`mailto:${CONTACT_EMAIL}?subject=Questionnaire%20submission%20query`}>Contact the team</a>
              <a href="/agreement/privacy-notice/">Read the Privacy Notice</a>
            </div>
          </section>

          <aside className="verify-guidance" aria-labelledby="duplicate-guidance-title">
            <p>WHAT TO DO NEXT</p>
            <h2 id="duplicate-guidance-title">Your earlier response remains the active submission</h2>
            <p>This page is a confirmation notice only. It does not collect questionnaire answers or show the contents of your response.</p>
            <ol>
              <li><span>1</span><div><strong>No further action is needed</strong><small>You can safely close this page.</small></div></li>
              <li><span>2</span><div><strong>Keep your confirmation</strong><small>Retain any receipt or confirmation provided by the original questionnaire.</small></div></li>
              <li><span>3</span><div><strong>Ask before resubmitting</strong><small>Contact the team if you need to correct or replace an earlier response.</small></div></li>
            </ol>
            <dl>
              <div><dt>Page purpose</dt><dd>Duplicate-submission notice</dd></div>
              <div><dt>Response handling</dt><dd>Managed by the original questionnaire</dd></div>
              <div><dt>Information collected here</dt><dd>None</dd></div>
            </dl>
          </aside>
        </div>

        <footer className="verify-footer">
          <div>
            <strong>University of Manchester Student Representative Mail System</strong>
            <span>Department of Chemistry &middot; Student Representatives Team</span>
          </div>
          <nav aria-label="Questionnaire notice information">
            <a href="/report/">Report an issue</a>
            <a href="/agreement/privacy-notice/">Privacy Notice</a>
            <a href={`mailto:${CONTACT_EMAIL}`}>Contact the team</a>
          </nav>
          <p>&copy; {new Date().getFullYear()} University of Manchester Student Representatives Team &middot; Technical support provided by Ziwen M.</p>
        </footer>
      </article>
    </main>
  );
}
