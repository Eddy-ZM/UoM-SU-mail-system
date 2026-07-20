import React from "react";
import { createRoot } from "react-dom/client";
import { AccessGate } from "./AccessGate.jsx";
import { App } from "./App.jsx";
import { PrivacyNotice } from "./PrivacyNotice.jsx";
import { PublicAccessNotice, WorkspaceAccessNotice } from "./PublicAccessNotice.jsx";
import { ReportIssue } from "./ReportIssue.jsx";
import { VerifyMessage } from "./VerifyMessage.jsx";
import "./styles.css";

const path = window.location.pathname.replace(/\/+$/, "") || "/";
const isPrivacyNotice = path === "/agreement/privacy-notice";
const isVerificationPage = path === "/verify";
const isReportPage = path === "/report";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isPrivacyNotice
      ? <PublicAccessNotice><PrivacyNotice /></PublicAccessNotice>
      : isVerificationPage
        ? <PublicAccessNotice><VerifyMessage /></PublicAccessNotice>
        : isReportPage
          ? <PublicAccessNotice><ReportIssue /></PublicAccessNotice>
        : (
          <AccessGate>
            {(currentUser) => (
              <WorkspaceAccessNotice>
                <App currentUser={currentUser} />
              </WorkspaceAccessNotice>
            )}
          </AccessGate>
        )}
  </React.StrictMode>,
);
