import { useEffect } from "react";

const CONTACT_EMAIL = "rongzhi.wu@student.manchester.ac.uk";

export function QuestionnaireThankYou() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Thank you for your feedback | Manchester Chemistry Student Representatives";
    return () => { document.title = previousTitle; };
  }, []);

  return (
    <main className="verify-page questionnaire-thank-you-page">
      <article className="verify-shell">
        <header className="verify-masthead">
          <div className="verify-text-identity" aria-label="Department of Chemistry Student Representatives">
            <span aria-hidden="true">Student representative service</span>
            <strong>Department of Chemistry Student Representatives</strong>
          </div>
          <div className="verify-department">
            <span>Questionnaire status</span>
            <strong>Response received</strong>
          </div>
        </header>

        <div className="verify-service-strip">
          <span>Student Representative Mail System</span>
          <strong>Student voice survey</strong>
        </div>

        <div className="verify-layout">
          <section className="verify-primary" aria-labelledby="questionnaire-thank-you-title">
            <p className="verify-kicker">YEAR 2 CHEMISTRY STUDENT VOICE SURVEY</p>
            <h1 id="questionnaire-thank-you-title">Thank you for your feedback</h1>
            <p className="verify-lead">
              Your response has been recorded. Thank you for taking the time to share your experiences, opinions and suggestions.
            </p>

            <dl className="questionnaire-response-status" aria-label="Questionnaire response status">
              <div><dt>Status</dt><dd>Response received</dd></div>
              <div><dt>Survey reference</dt><dd>2610281</dd></div>
            </dl>

            <p className="questionnaire-response-note">
              Your feedback helps the Student Representatives Team understand the student experience, identify areas for improvement and raise relevant concerns with the School of Chemistry.
            </p>

            <p className="questionnaire-response-emphasis">
              Your voice matters, and we appreciate your contribution towards improving our shared learning experience.
            </p>

            <div className="questionnaire-response-actions">
              <a className="questionnaire-response-primary" href={`mailto:${CONTACT_EMAIL}?subject=Year%202%20Chemistry%20Student%20Voice%20Survey`}>Contact the team</a>
              <a href="/agreement/privacy-notice/">Read the Privacy Notice</a>
            </div>
          </section>

          <aside className="verify-guidance" aria-labelledby="questionnaire-next-title">
            <p>WHAT HAPPENS NEXT</p>
            <h2 id="questionnaire-next-title">We will review the responses carefully</h2>
            <p>The team will use the responses to understand shared experiences and identify the issues students would most like us to raise.</p>
            <ol>
              <li><span>1</span><div><strong>Review responses</strong><small>We will read and organise the feedback received.</small></div></li>
              <li><span>2</span><div><strong>Identify key themes</strong><small>Recurring experiences and suggestions will be considered together.</small></div></li>
              <li><span>3</span><div><strong>Raise relevant feedback</strong><small>Key themes will be communicated to the appropriate staff members.</small></div></li>
            </ol>
            <dl>
              <div><dt>Survey</dt><dd>Year 2 Chemistry Student Voice Survey</dd></div>
              <div><dt>Service owner</dt><dd>Department of Chemistry Student Representatives</dd></div>
              <div><dt>Information collected here</dt><dd>None</dd></div>
            </dl>
          </aside>
        </div>

        <footer className="verify-footer">
          <div>
            <strong>University of Manchester Student Representative Mail System</strong>
            <span>Department of Chemistry &middot; Student Representatives Team</span>
          </div>
          <nav aria-label="Questionnaire response information">
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
