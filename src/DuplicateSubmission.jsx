import { useEffect, useState } from "react";
import { CheckCircle } from "@phosphor-icons/react";

const CONTACT_EMAIL = "rongzhi.wu@student.manchester.ac.uk";

export function DuplicateSubmission() {
  const [showCloseHint, setShowCloseHint] = useState(false);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Questionnaire already submitted | Manchester Chemistry Student Representatives";
    return () => { document.title = previousTitle; };
  }, []);

  const closePage = () => {
    window.close();
    window.setTimeout(() => setShowCloseHint(true), 150);
  };

  return (
    <main className="questionnaire-complete-page duplicate-submission-page">
      <header className="questionnaire-complete-header">
        <p>Student Representative Service</p>
        <strong>Department of Chemistry Student Representatives</strong>
      </header>

      <section className="questionnaire-complete-content" aria-labelledby="duplicate-submission-title">
        <CheckCircle className="questionnaire-complete-icon" size={132} weight="regular" aria-hidden="true" />
        <h1 id="duplicate-submission-title">This questionnaire has already been submitted</h1>
        <p className="questionnaire-complete-lead">Your previous response remains recorded.</p>

        <div className="questionnaire-complete-survey" aria-label="Questionnaire submission status">
          <strong>No further submission is required</strong>
          <span>This page does not collect questionnaire answers.</span>
        </div>

        <p className="questionnaire-complete-next">
          Visiting this page does not change or replace your earlier response. Contact the team if you believe this notice is incorrect or need to update your submission.
        </p>

        <div className="questionnaire-complete-actions">
          <button className="questionnaire-complete-primary" type="button" onClick={closePage}>Close</button>
          <div className="questionnaire-complete-links">
            <a href={`mailto:${CONTACT_EMAIL}?subject=Questionnaire%20submission%20query`}>Contact the team</a>
            <a href="/agreement/privacy-notice/">Privacy notice</a>
          </div>
        </div>
        {showCloseHint && (
          <p className="questionnaire-complete-close-hint" role="status">
            Your browser did not close this tab. You can close it manually.
          </p>
        )}
      </section>

      <footer className="questionnaire-complete-footer">
        <p>&copy; {new Date().getFullYear()} University of Manchester Student Representatives Team &middot; Technical support provided by Ziwen M.</p>
      </footer>
    </main>
  );
}
