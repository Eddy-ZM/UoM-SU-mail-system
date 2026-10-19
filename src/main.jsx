import React from "react";
import { createRoot } from "react-dom/client";
import { AccessGate } from "./AccessGate.jsx";
import { App } from "./App.jsx";
import { PrivacyNotice } from "./PrivacyNotice.jsx";
import { ReportIssue } from "./ReportIssue.jsx";
import { VerifyMessage } from "./VerifyMessage.jsx";
import { DuplicateSubmission } from "./DuplicateSubmission.jsx";
import { QuestionnaireThankYou } from "./QuestionnaireThankYou.jsx";
import "./styles.css";

const path = window.location.pathname.replace(/\/+$/, "") || "/";
const isPrivacyNotice = path === "/agreement/privacy-notice";
const isVerificationPage = path === "/verify";
const isReportPage = path === "/report";
const isDuplicateSubmissionPage = path === "/questionnaire/already-submitted";
const isQuestionnaireThankYouPage = path === "/questionnaire/thank-you";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isPrivacyNotice
      ? <PrivacyNotice />
      : isVerificationPage
        ? <VerifyMessage />
        : isReportPage
          ? <ReportIssue />
          : isDuplicateSubmissionPage
            ? <DuplicateSubmission />
            : isQuestionnaireThankYouPage
              ? <QuestionnaireThankYou />
              : (
                <AccessGate>
                  {(currentUser) => <App currentUser={currentUser} />}
                </AccessGate>
              )}
  </React.StrictMode>,
);
