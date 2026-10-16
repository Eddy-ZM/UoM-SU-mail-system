import { archiveAccessError, archiveErrorResponse, resolveArchiveAccess } from "../../_lib/archive-api.js";
import { getArchive } from "../../_lib/archive-store.js";
import {
  OUTLOOK_GRAPH_SCOPE,
  archivedEmailIsIntact,
  createOutlookTransaction,
  outlookConfiguration,
  outlookErrorPage,
  outlookTransactionCookie,
  sameOriginRequest,
  verifiedUserId,
} from "../../_lib/outlook-oauth.js";

export async function onRequestPost(context) {
  const decision = await resolveArchiveAccess(context);
  if (decision.kind !== "allowed") return archiveAccessError(decision, context.request, context.env);
  if (!sameOriginRequest(context.request)) return outlookErrorPage("Request blocked", "Return to the mail studio and try again.", 403);

  const configuration = outlookConfiguration(context.env, context.request.url);
  if (!configuration.configured) {
    return outlookErrorPage("Outlook connection is not configured", "Download the .eml draft from the receipt while the Microsoft 365 connection is being configured.", 503);
  }

  try {
    const form = await context.request.formData();
    const archiveId = String(form.get("archiveId") || "").trim();
    const archive = await getArchive(context.env.ARCHIVE_DB, archiveId);
    if (!archive) return outlookErrorPage("Archive not found", "The archived email could not be found.", 404);
    if (!archive.canReopen || !archive.html) return outlookErrorPage("Archive window closed", "This email can no longer be reopened to create an Outlook draft. Download a retained copy from the archive if available.", 410);
    if (archive.operation !== "copy_outlook" || !(await archivedEmailIsIntact(archive))) {
      return outlookErrorPage("Archive integrity check failed", "The Outlook draft was not created because the protected email content could not be verified.", 409);
    }

    const userId = verifiedUserId(decision.user);
    if (!userId) return outlookErrorPage("Account could not be verified", "Sign in to the mail studio again and retry.", 403);
    const transaction = await createOutlookTransaction({ archiveId, userId, stateSecret: configuration.stateSecret });
    const authorizationUrl = new URL(`https://login.microsoftonline.com/${configuration.tenantId}/oauth2/v2.0/authorize`);
    authorizationUrl.searchParams.set("client_id", configuration.clientId);
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("response_mode", "query");
    authorizationUrl.searchParams.set("redirect_uri", configuration.redirectUri);
    authorizationUrl.searchParams.set("scope", OUTLOOK_GRAPH_SCOPE);
    authorizationUrl.searchParams.set("state", transaction.state);
    authorizationUrl.searchParams.set("code_challenge", transaction.challenge);
    authorizationUrl.searchParams.set("code_challenge_method", "S256");

    return new Response(null, {
      status: 303,
      headers: {
        location: authorizationUrl.toString(),
        "set-cookie": outlookTransactionCookie(transaction.cookieValue),
        "cache-control": "no-store",
        "referrer-policy": "no-referrer",
      },
    });
  } catch (error) {
    return archiveErrorResponse(error);
  }
}
