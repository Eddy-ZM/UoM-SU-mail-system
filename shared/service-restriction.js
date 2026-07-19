export const ACCESS_RESTRICTION_TITLE = "Limited pre-release access";

export const ACCESS_RESTRICTION_MESSAGE =
  "Pending approval from the University of Manchester Department of Chemistry and other relevant University departments, access to the service's principal features is temporarily restricted.";

export const PUBLIC_ACCESS_RESTRICTION_TITLE = "Public services remain available";

export const PUBLIC_ACCESS_RESTRICTION_MESSAGE =
  `${ACCESS_RESTRICTION_MESSAGE} This public page remains available during the pre-release period.`;

export const WORKSPACE_PRE_RELEASE_TITLE = "Authorised pre-release access";

export const WORKSPACE_PRE_RELEASE_MESSAGE =
  "This service is awaiting approval from the University of Manchester Department of Chemistry and other relevant University departments. Your account has been granted pre-release access to all service features, including archive viewing and creation.";

export const RESTRICTION_NOTICE_BYPASS_PARAM = "restrictionNotice";
export const RESTRICTION_NOTICE_BYPASS_VALUE = "shown";

export function publicPathFromRestriction(pathname) {
  const separator = pathname.includes("?") ? "&" : "?";
  return `${pathname}${separator}${RESTRICTION_NOTICE_BYPASS_PARAM}=${RESTRICTION_NOTICE_BYPASS_VALUE}`;
}

export function shouldBypassRepeatedPublicNotice(search = "") {
  return new URLSearchParams(search).get(RESTRICTION_NOTICE_BYPASS_PARAM) === RESTRICTION_NOTICE_BYPASS_VALUE;
}
