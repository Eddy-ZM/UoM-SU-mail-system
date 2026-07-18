import { useEffect } from "react";

const MICROSOFT_PRIVACY_URL = "https://privacy.microsoft.com/en-gb/privacystatement";
const MICROSOFT_FORMS_PRIVACY_URL = "https://support.microsoft.com/en-us/forms/security-and-privacy-in-microsoft-forms";

function PolicySection({ number, title, children }) {
  return (
    <section className="policy-section" id={`policy-section-${number}`} aria-labelledby={`policy-heading-${number}`}>
      <h2 id={`policy-heading-${number}`}><span>{Number(number)}.</span> {title}</h2>
      {children}
    </section>
  );
}

const POLICY_CONTENTS = [
  ["01", "Who we are and when this notice applies"],
  ["02", "Acknowledgement, consent and choice"],
  ["03", "Information we collect"],
  ["04", "How and why we use information"],
  ["05", "Lawful bases and sensitive information"],
  ["06", "Microsoft 365 Forms and other service providers"],
  ["07", "Who can access information and when it may be shared"],
  ["08", "International processing"],
  ["09", "Retention and deletion"],
  ["10", "Security"],
  ["11", "Cookies, local storage and similar technologies"],
  ["12", "Your data-protection rights"],
  ["13", "Contact us"],
  ["14", "Changes to this notice"],
];

export function PrivacyNotice() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Privacy Notice | University of Manchester Student Representative Mail System";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <div className="policy-page">
      <header className="policy-masthead">
        <div className="policy-masthead-inner">
          <a className="policy-brand" href="/" aria-label="Return to the mail system">
            <img
              src="https://www.library.manchester.ac.uk/assets/images/design/logo-university-of-manchester.png"
              alt="The University of Manchester"
            />
            <span><strong>Department of Chemistry</strong><br />Student Representatives</span>
          </a>
          <div className="policy-header-actions">
            <span>Privacy Notice<br />Reference: UOM-CHEM-SR-PRIV-001</span>
            <a className="policy-return-link" href="/">Return to Mail System</a>
          </div>
        </div>
      </header>

      <main className="policy-main">
        <div className="policy-hero">
          <p className="policy-kicker">The University of Manchester · Department of Chemistry</p>
          <h1>Privacy Notice</h1>
          <p className="policy-document-subtitle">University of Manchester Student Representative Mail System</p>
          <p className="policy-lead">
            This notice explains how the Department of Chemistry Student Representatives Team handles information
            when representatives use the Mail System and when students submit responses through Microsoft 365 Forms,
            surveys, questionnaires or feedback channels linked from our announcements.
          </p>
          <table className="policy-document-control">
            <caption>Document control</caption>
            <tbody>
              <tr><th scope="row">Document owner</th><td>Department of Chemistry Student Representatives Team</td><th scope="row">Reference</th><td>UOM-CHEM-SR-PRIV-001</td></tr>
              <tr><th scope="row">Effective date</th><td>1 July 2026</td><th scope="row">Last reviewed</th><td>18 July 2026</td></tr>
              <tr><th scope="row">Version</th><td>1.2</td><th scope="row">Next review</th><td>By 1 July 2027</td></tr>
            </tbody>
          </table>
        </div>

        <aside className="policy-summary" aria-label="Privacy notice summary">
          <h2>Purpose of this notice</h2>
          <p>
            If you submit information through a form, questionnaire or response channel that links to this notice,
            authorised members of the Student Representatives Team may access and analyse your submission for student
            representation purposes. We normally report themes in an aggregated or anonymised form and do not sell
            personal information.
          </p>
        </aside>

        <nav className="policy-contents" aria-labelledby="policy-contents-heading">
          <h2 id="policy-contents-heading">Contents</h2>
          <ol>
            {POLICY_CONTENTS.map(([number, title]) => (
              <li key={number}><a href={`#policy-section-${number}`}><span>{Number(number)}.</span> {title}</a></li>
            ))}
          </ol>
        </nav>

        <div className="policy-content">
          <PolicySection number="01" title="Who we are and when this notice applies">
            <p>
              The University of Manchester Student Representative Mail System (the <strong>“Service”</strong>) is
              developed and operated by the University of Manchester Department of Chemistry Student Representatives
              Team (the <strong>“Team”</strong> or <strong>“we”</strong>). Technical support is provided by Ziwen M.
            </p>
            <p>This notice applies to:</p>
            <ul>
              <li>the Mail System website and announcement emails generated through it;</li>
              <li>Microsoft 365 Forms, surveys, polls and questionnaires published by the Team that link to or expressly reference this notice;</li>
              <li>feedback, follow-up correspondence and other response channels identified in those announcements or forms; and</li>
              <li>representatives, students and other people whose personal information is handled through those activities.</li>
            </ul>
            <p>
              A particular form may display additional privacy information. That form-specific information supplements
              this notice and takes priority if it describes a more specific purpose, retention period or recipient.
              Relevant University, Students&apos; Union and Microsoft notices may also apply to their respective services.
            </p>
          </PolicySection>

          <PolicySection number="02" title="Acknowledgement, consent and choice">
            <p>
              Please read this notice before using the Service or submitting a form. By continuing, you acknowledge that
              you have been given this privacy information. Acknowledgement is not treated as consent for every use of
              personal information. Where consent is the appropriate lawful basis, the relevant form will request it
              separately and you may withdraw it without affecting processing already carried out lawfully.
            </p>
            <p>
              Unless a form clearly states otherwise, participation is voluntary. You may choose not to answer optional
              questions. If required information is not provided, we may be unable to record, investigate or respond to
              the matter raised.
            </p>
          </PolicySection>

          <PolicySection number="03" title="Information we collect">
            <h3>Mail System website</h3>
            <p>
              The editor requires a ChemVault User System account with specific permission to use the Service. For
              access control and accountability, we process the authenticated user&apos;s User System identifier, email
              address and system role. Draft data remains in the browser&apos;s local storage on the device being used until
              a representative chooses an export action.
            </p>
            <p>
              Before Copy HTML, Copy for Outlook or Download HTML is completed, the Service creates an immutable audit
              backup containing the complete exported HTML, subject, filename, message number, full SHA-256 digest,
              short verification code, export operation, authenticated submitter identifier, email and role, and the
              server-recorded time. The full SHA-256 value remains internal; the email displays only a formatted
              64-bit lookup code derived from its first 16 hexadecimal characters.
              If that backup cannot be created, the copy or download does not proceed. Hosting and security providers
              may also process ordinary request information such as IP address, browser type, request time and requested
              page for delivery, security and abuse prevention.
            </p>
            <h3>Microsoft 365 Forms and student submissions</h3>
            <p>Depending on the form, we may collect:</p>
            <ul>
              <li>your name, University email address or other contact details, where requested;</li>
              <li>course, programme, year group, cohort or other academic context;</li>
              <li>answers, ratings, opinions, free-text comments and files that you choose to submit;</li>
              <li>whether you would like a representative to contact you; and</li>
              <li>submission time and technical or account information generated by Microsoft 365 Forms.</li>
            </ul>
            <p>
              The form will state whether responses are anonymous. Please do not include names, student numbers,
              health information or other sensitive details in free-text fields unless the form specifically asks for
              them and explains why they are needed.
            </p>
          </PolicySection>

          <PolicySection number="04" title="How and why we use information">
            <p>We may use information to:</p>
            <ul>
              <li>operate the Mail System and deliver representative announcements;</li>
              <li>create immutable export records so the Team can verify whether an announcement is authentic and maintain accountability for formal communications;</li>
              <li>provide a public online check for a message number and short verification code without disclosing the archived email or its submitter;</li>
              <li>administer surveys, questionnaires, polls, consultations and feedback exercises;</li>
              <li>read, organise, classify and analyse submissions, including statistical and thematic analysis;</li>
              <li>identify recurring issues and understand student experience within the Department of Chemistry;</li>
              <li>prepare aggregated or anonymised summaries, reports and recommendations;</li>
              <li>raise issues with appropriate representatives, Department staff, the University or the Students&apos; Union;</li>
              <li>respond to you or follow up a concern where you request this;</li>
              <li>maintain service security, prevent abuse and investigate technical problems; and</li>
              <li>meet applicable legal, regulatory, safeguarding or record-keeping duties.</li>
            </ul>
            <p>
              We do not use identifiable responses for advertising, sell them, or make decisions producing legal or
              similarly significant effects solely by automated means. Identifiable responses will not be submitted to
              generative AI tools for analysis. If automated analysis is introduced in future, it will be limited to
              properly anonymised material unless a revised notice and an appropriate lawful basis are provided first.
            </p>
          </PolicySection>

          <PolicySection number="05" title="Lawful bases and sensitive information">
            <p>
              The lawful basis depends on who is responsible for a particular collection and why the information is
              needed. Processing may be necessary for the legitimate interests of effective student representation and
              service administration; for a task carried out in the public interest by the University; to act on your
              consent; to comply with a legal obligation; or, in an emergency, to protect vital interests. The relevant
              form will identify any more specific basis where required.
            </p>
            <p>
              Information about health, disability, ethnicity, political or religious beliefs, sexual orientation,
              trade-union membership, genetic or biometric identifiers is subject to additional protection. We will not
              intentionally request or use such special-category information unless it is necessary, proportionate and
              supported by an appropriate Article 9 UK GDPR condition and safeguards. Do not submit this information
              unless the form expressly requests it.
            </p>
          </PolicySection>

          <PolicySection number="06" title="Microsoft 365 Forms and other service providers">
            <p>
              Team forms are provided through Microsoft 365 Forms within the applicable organisational Microsoft 365
              environment. Microsoft processes form responses, account and service data to provide and secure that
              service under the applicable institutional agreement, Microsoft Product Terms and Data Protection
              Addendum. Microsoft states that Forms data is encrypted both in transit and at rest.
            </p>
            <p>
              When you open or submit a Microsoft form, the applicable <a href={MICROSOFT_PRIVACY_URL}>Microsoft Privacy Statement</a> and
              Microsoft 365 terms apply alongside this notice and any form-specific wording. You can also review
              Microsoft&apos;s <a href={MICROSOFT_FORMS_PRIVACY_URL}>Security and Privacy in Microsoft Forms</a> information.
              Microsoft&apos;s policies govern Microsoft&apos;s own processing; this notice governs the Team&apos;s access to and
              use of your response.
            </p>
            <p>
              The website is delivered through Cloudflare, which may process limited network and security data to serve
              pages and protect the Service. Immutable email export records are stored in a Cloudflare D1 database
              configured for the European Union jurisdiction. Links to third-party websites are governed by those
              websites&apos; own notices.
            </p>
          </PolicySection>

          <PolicySection number="07" title="Who can access information and when it may be shared">
            <p>
              Access to identifiable form responses is limited to authorised Student Representatives and, where
              necessary, authorised University or Students&apos; Union personnel who need the information for the stated
              purpose. We may share:
            </p>
            <p>
              Authorised Mail System users may search archive metadata by email subject, message number, verification code or SHA-256 and inspect a
              read-only backup where this is necessary for authenticity verification, accountability or investigation.
              The Service provides no archive-editing interface. Only the account
              <strong> ziwen.mu@chemvault.science</strong> is permitted by the server to delete an archive record; other
              authorised users cannot delete records.
            </p>
            <p>
              Anyone with the message number and short verification code printed in an announcement may use the public
              verification page. The check returns only whether the pair matches an immutable archive and, for a valid
              match, when it was first archived. An invalid response does not reveal whether the number, the code or both
              were incorrect, and the public service never returns the email HTML, full SHA-256 or submitter identity.
            </p>
            <ul>
              <li>aggregated or anonymised findings with students, Department staff, the University or the Students&apos; Union;</li>
              <li>identifiable information where you have requested or authorised a referral or follow-up;</li>
              <li>the minimum information necessary with approved service providers acting under appropriate terms;</li>
              <li>information required by law, court order or a competent authority; or</li>
              <li>information necessary to address a credible and serious safeguarding risk or threat to life.</li>
            </ul>
            <p>
              We do not publish identifiable survey answers or disclose them merely because they are interesting or
              useful. Before reporting results, we will take reasonable steps to remove direct identifiers and avoid
              combinations of details that could identify a respondent.
            </p>
          </PolicySection>

          <PolicySection number="08" title="International processing">
            <p>
              Microsoft, Cloudflare or another approved provider may process limited information outside the United
              Kingdom. Where restricted transfers occur, the responsible organisation and provider must use an
              applicable adequacy regulation, contractual safeguards or another lawful transfer mechanism. Information
              about provider safeguards is available through the linked provider documents or on request.
            </p>
          </PolicySection>

          <PolicySection number="09" title="Retention and deletion">
            <ul>
              <li>Mail drafts remain in local browser storage until the user resets the template, clears site data or removes them from that device.</li>
              <li>Immutable email export backups are reviewed at least annually and are normally retained for no longer than six years, where necessary to verify formal announcements, investigate misuse and maintain an accountable communications record. A record may be retained longer where a legal, safeguarding, complaint or active-investigation requirement applies.</li>
              <li>Survey and questionnaire responses are normally retained for no longer than two years after the relevant form closes, then securely deleted or irreversibly anonymised.</li>
              <li>Contact details collected only for follow-up are removed when follow-up is complete and normally within twelve months.</li>
              <li>A form-specific notice may set a shorter period or, where justified, a longer period required by law, safeguarding, an active complaint or formal University or Students&apos; Union records policy.</li>
            </ul>
          </PolicySection>

          <PolicySection number="10" title="Security">
            <p>
              We use proportionate organisational and technical measures, including access controls, approved
              University or Microsoft 365 accounts where applicable, encryption in transit, provider security controls,
              data minimisation, anonymisation and deletion. No internet service can guarantee absolute security. If we
              identify a personal-data incident, it will be escalated through the appropriate University or Students&apos;
              Union process and notified where required.
            </p>
            <p>
              Email backups are write-once records: the database rejects updates and the Service exposes no modification
              operation. Access requires the Mail System permission in ChemVault User System, and the delete endpoint
              separately checks the authenticated email against the sole authorised archive owner.
            </p>
          </PolicySection>

          <PolicySection number="11" title="Cookies, local storage and similar technologies">
            <p>
              The Mail System uses local browser storage to preserve an editor draft and preferences. It is necessary for
              the editor&apos;s save-and-restore function and is not used for cross-site advertising. It also uses a secure,
              host-only authentication handoff cookie so ChemVault User System can verify the signed-in account. We do
              not currently set marketing or behavioural advertising cookies. Cloudflare or Microsoft may use strictly necessary security,
              authentication or service technologies under their own notices. Blocking local storage may prevent draft
              saving; blocking Microsoft&apos;s necessary technologies may prevent a form from working correctly.
            </p>
          </PolicySection>

          <PolicySection number="12" title="Your data-protection rights">
            <p>
              Depending on the circumstances and lawful basis, you may have rights to be informed; request access;
              correct inaccurate information; request erasure; restrict processing; receive portable data; object to
              processing; and withdraw consent where processing relies on consent. These rights are not absolute, and we
              may need to verify your identity before acting on a request.
            </p>
            <div className="policy-right-to-object">
              <strong>Your right to object</strong>
              <p>
                You may object to processing based on legitimate interests or a public task. Tell us what processing you
                object to and why it affects you. The appropriate responsible organisation will assess the request under
                applicable data-protection law.
              </p>
            </div>
            <p>
              If a form was genuinely anonymous and the response can no longer be linked to you, we may be unable to
              locate or delete an individual response. You may also complain to the UK Information Commissioner&apos;s
              Office at <a href="https://ico.org.uk/make-a-complaint/">ico.org.uk/make-a-complaint</a>.
            </p>
          </PolicySection>

          <PolicySection number="13" title="Contact us">
            <p>For questions, requests or concerns about this notice or a Team-managed form, contact:</p>
            <address className="policy-contacts">
              <div><strong>Rongzhi Wu</strong><span>Student Representative</span><a href="mailto:rongzhi.wu@student.manchester.ac.uk">rongzhi.wu@student.manchester.ac.uk</a></div>
              <div><strong>Wenqian Zhang</strong><span>Student Representative</span><a href="mailto:wenqian.zhang-10@student.manchester.ac.uk">wenqian.zhang-10@student.manchester.ac.uk</a></div>
            </address>
            <p>
              Where The University of Manchester is responsible for the processing, you may also contact its Information
              Governance Office at <a href="mailto:dataprotection@manchester.ac.uk">dataprotection@manchester.ac.uk</a>.
              Where the Students&apos; Union is responsible, its <a href="https://manchesterstudentsunion.com/privacy-policy">Privacy Notice</a> explains how to contact its Data Protection Officer.
            </p>
          </PolicySection>

          <PolicySection number="14" title="Changes to this notice">
            <p>
              We may update this notice to reflect changes to the Service, forms, providers or law. The revised version
              will be published here with a new “last updated” date. Material new uses of personal information will be
              brought to affected people&apos;s attention before that use begins where required.
            </p>
          </PolicySection>
        </div>
      </main>

      <footer className="policy-footer">
        <div><strong>Document reference</strong><span>UOM-CHEM-SR-PRIV-001 · Version 1.2</span></div>
        <div><strong>Owner</strong><span>Department of Chemistry Student Representatives Team</span></div>
        <div><strong>Copyright</strong><span>&copy; 2026 The University of Manchester Student Representatives Team. Technical support provided by Ziwen M.</span></div>
      </footer>
    </div>
  );
}
