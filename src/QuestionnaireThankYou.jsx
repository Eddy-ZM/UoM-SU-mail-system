import { useEffect } from "react";
import { CheckCircle } from "@phosphor-icons/react";

const CONTACT_EMAIL = "rongzhi.wu@student.manchester.ac.uk";

export function QuestionnaireThankYou() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Thank you for your feedback | Manchester Chemistry Student Representatives";
    return () => { document.title = previousTitle; };
  }, []);

  return (
    <main className="questionnaire-complete-page">
      <header className="questionnaire-complete-header">
        <p>Student Representative Service</p>
        <strong>Department of Chemistry Student Representatives</strong>
      </header>

      <section className="questionnaire-complete-content" aria-labelledby="questionnaire-thank-you-title">
        <CheckCircle className="questionnaire-complete-icon" size={132} weight="regular" aria-hidden="true" />
        <h1 id="questionnaire-thank-you-title">Thank you for your feedback</h1>
        <p className="questionnaire-complete-lead">Your response has been recorded.</p>

        <div className="questionnaire-complete-survey" aria-label="Questionnaire details">
          <strong>Year 2 Chemistry Student Voice Survey</strong>
          <span>Survey reference 2610281</span>
        </div>

        <p className="questionnaire-complete-next">
          We will review the responses and raise the key themes with the School of Chemistry.
        </p>

        <div className="questionnaire-complete-actions">
          <a className="questionnaire-complete-primary" href={`mailto:${CONTACT_EMAIL}?subject=Year%202%20Chemistry%20Student%20Voice%20Survey`}>Contact the team</a>
          <a href="/agreement/privacy-notice/">Privacy notice</a>
        </div>
      </section>

      <footer className="questionnaire-complete-footer">
        <p>&copy; {new Date().getFullYear()} University of Manchester Student Representatives Team &middot; Technical support provided by Ziwen M.</p>
      </footer>
    </main>
  );
}
