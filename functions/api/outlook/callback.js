import { resolveArchiveAccess } from "../../_lib/archive-api.js";
import { getArchive } from "../../_lib/archive-store.js";
import {
  OUTLOOK_GRAPH_SCOPE,
  OUTLOOK_OAUTH_COOKIE,
  archivedEmailIsIntact,
  clearOutlookTransactionCookie,
  outlookConfiguration,
  outlookErrorPage,
  readNamedCookie,
  readOutlookTransaction,
  transactionMatches,
  trustedOutlookWebLink,
  verifiedUserId,
} from "../../_lib/outlook-oauth.js";

function failure(title, message, status = 400) {
  return outlookErrorPage(title, message, status, { "set-cookie": clearOutlookTransactionCookie() });
}

export async function onRequestGet(context) {
  const decision = await resolveArchiveAccess(context);
  if (decision.kind !== "allowed") return failure("Mail studio session expired", "Return to the mail studio, sign in and create the Outlook draft again.", 401);
  const configuration = outlookConfiguration(context.env, context.request.url);
  if (!configuration.configured) return failure("Outlook connection is unavailable", "Return to the mail studio and download the .eml draft instead.", 503);

  const requestUrl = new URL(context.request.url);
  const returnedState = requestUrl.searchParams.get("state");
  const code = requestUrl.searchParams.get("code");
  const transactionCookie = readNamedCookie(context.request, OUTLOOK_OAUTH_COOKIE);
  if (requestUrl.searchParams.has("error")) return failure("Microsoft 365 authorisation was not completed", "No Outlook draft was created. You can close this window and use the .eml download instead.");
  if (!returnedState || !code || !transactionCookie) return failure("Outlook authorisation expired", "Return to the mail studio and select Create Outlook draft again.");

  try {
    const transaction = await readOutlookTransaction(transactionCookie, configuration.stateSecret);
    const userMatches = transactionMatches(transaction.userId, verifiedUserId(decision.user));
    if (!transactionMatches(returnedState, transaction.state) || !userMatches || transaction.exp < Date.now()) {
      return failure("Outlook authorisation could not be verified", "Return to the mail studio and start again.", 403);
    }

    const archive = await getArchive(context.env.ARCHIVE_DB, transaction.archiveId);
    if (!archive?.canReopen || !archive.html) return failure("Archive window closed", "The archived email is no longer available for creating a draft.", 410);
    if (archive.operation !== "copy_outlook" || !(await archivedEmailIsIntact(archive))) {
      return failure("Archive integrity check failed", "The Outlook draft was not created because the protected email content could not be verified.", 409);
    }

    const tokenResponse = await fetch(`https://login.microsoftonline.com/${configuration.tenantId}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: configuration.clientId,
        client_secret: configuration.clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: configuration.redirectUri,
        code_verifier: transaction.verifier,
        scope: OUTLOOK_GRAPH_SCOPE,
      }),
    });
    if (!tokenResponse.ok) return failure("Microsoft 365 authorisation failed", "No draft was created. Close this window and use the .eml download instead.", 502);
    const token = await tokenResponse.json();
    if (!token.access_token) return failure("Microsoft 365 authorisation failed", "No access token was returned and no draft was created.", 502);

    const graphResponse = await fetch("https://graph.microsoft.com/v1.0/me/messages", {
      method: "POST",
      headers: { authorization: `Bearer ${token.access_token}`, "content-type": "application/json" },
      body: JSON.stringify({ subject: archive.subject, body: { contentType: "HTML", content: archive.html } }),
    });
    if (graphResponse.status !== 201) return failure("Outlook could not create the draft", "No email was sent. Close this window and use the .eml download instead.", 502);
    const draft = await graphResponse.json();
    const webLink = trustedOutlookWebLink(draft.webLink);
    if (!webLink) return failure("Outlook returned an invalid draft link", "The draft may exist in your Outlook Drafts folder. Open Outlook directly to check it.", 502);

    return new Response(null, {
      status: 303,
      headers: { location: webLink, "set-cookie": clearOutlookTransactionCookie(), "cache-control": "no-store", "referrer-policy": "no-referrer" },
    });
  } catch {
    return failure("Outlook authorisation could not be completed", "Return to the mail studio and use the .eml download instead.", 400);
  }
}
