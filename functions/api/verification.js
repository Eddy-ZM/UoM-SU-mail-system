import { jsonResponse } from "../_lib/access-gate.js";
import { verifyArchivedMessage } from "../_lib/archive-store.js";

export async function onRequestPost({ request, env }) {
  let payload = {};
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ valid: false });
  }

  try {
    return jsonResponse(await verifyArchivedMessage(env.ARCHIVE_DB, payload.messageNumber, payload.verificationCode));
  } catch {
    return jsonResponse({ error: "verification_unavailable" }, 503);
  }
}

export function onRequestGet() {
  return jsonResponse({ error: "method_not_allowed" }, 405, { allow: "POST" });
}
