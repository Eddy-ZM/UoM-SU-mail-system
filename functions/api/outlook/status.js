import { jsonResponse } from "../../_lib/access-gate.js";
import { outlookConfiguration } from "../../_lib/outlook-oauth.js";

export function onRequestGet(context) {
  const configuration = outlookConfiguration(context.env, context.request.url);
  return jsonResponse({ configured: configuration.configured }, 200, { "cache-control": "no-store" });
}
