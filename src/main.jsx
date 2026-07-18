import React from "react";
import { createRoot } from "react-dom/client";
import { AccessGate } from "./AccessGate.jsx";
import { App } from "./App.jsx";
import { PrivacyNotice } from "./PrivacyNotice.jsx";
import "./styles.css";

const path = window.location.pathname.replace(/\/+$/, "") || "/";
const isPrivacyNotice = path === "/agreement/privacy-notice";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isPrivacyNotice ? <PrivacyNotice /> : <AccessGate><App /></AccessGate>}
  </React.StrictMode>,
);
