import React from "react";
import { createRoot } from "react-dom/client";
import { AccessGate } from "./AccessGate.jsx";
import { App } from "./App.jsx";
import { PrivacyNotice } from "./PrivacyNotice.jsx";
import { VerifyMessage } from "./VerifyMessage.jsx";
import "./styles.css";

const path = window.location.pathname.replace(/\/+$/, "") || "/";
const isPrivacyNotice = path === "/agreement/privacy-notice";
const isVerificationPage = path === "/verify";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isPrivacyNotice
      ? <PrivacyNotice />
      : isVerificationPage
        ? <VerifyMessage />
        : <AccessGate>{(currentUser) => <App currentUser={currentUser} />}</AccessGate>}
  </React.StrictMode>,
);
