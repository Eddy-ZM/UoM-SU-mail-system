import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { PrivacyNotice } from "./PrivacyNotice.jsx";
import "./styles.css";

const path = window.location.pathname.replace(/\/+$/, "") || "/";
const RootPage = path === "/agreement/privacy-notice" ? PrivacyNotice : App;

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RootPage />
  </React.StrictMode>,
);
