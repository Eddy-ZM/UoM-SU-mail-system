# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Branding

- Include The University of Manchester logo in the email template and its exported/copied output only. Keep the website interface, public pages, access notices and workspace chrome text-only; do not add the University logo to them.
- Treat the email-only University logo as protected content: deleting it or changing its source, identity attributes or fixed dimensions must trigger recovery, and malformed or core-layout-damaged HTML must not be saved, copied, archived or downloaded.
- Use `https://mailsys.uomsu.chemvault.science/` as the canonical public origin. Do not expose `pages.dev` URLs in student-facing links; legacy visits to the Pages report URL should redirect to the canonical report page.

## Email composition

- New emails default to the `Questionnaire` preset. Its student-facing body copy should sound warm, direct and approachable rather than highly formal, while privacy, verification and institutional footer wording remains formal and unchanged.
- The immutable archive receipt must show the Outlook subject. When the tenant-scoped Microsoft Graph connection is configured, offer creation of the complete HTML message directly in the representative's Outlook Drafts folder and open the returned Outlook web link; never request `Mail.Send` or send on the user's behalf. Keep `Download .eml` and `Copy to Outlook` as fallbacks. When Graph is unavailable, automatically download one editable `.eml` draft and retain the manual re-download button; never trigger the automatic download more than once per archive.

## Production access

- Keep service entry and in-service content access as separate permissions. `service:uom-su-mail-system:access` alone controls whether a signed-in user may enter the service; preserve its existing assignments and meaning.
- After service entry is allowed, `feature:uom-su-mail-system:full_access` controls the principal workspace and archive features. It is allowed by default for active users; an explicit Deny must still show the English full-screen restriction notice and block archive viewing and creation.
- `ziwen.mu@chemvault.science` and `test@chemvault.science` remain bootstrap allowed accounts for service entry. An explicit deny still wins. Never copy or couple service-entry decisions into the content-access permission.
- Public verification, reporting and privacy pages remain directly usable without a pre-release notice.
- The public duplicate-questionnaire redirect target is `/questionnaire/already-submitted/`. It must remain usable without sign-in, explain that no further response is required, state that the page itself collects no answers, and provide team-contact and privacy links.
- Match the duplicate-questionnaire notice to the same minimal Forms-like completion layout and white copyright footer as the thank-you route. Use the same Close action and underlined Contact/Privacy links while retaining the no-resubmission and non-collection explanations.
- The successful Year 2 Chemistry Student Voice Survey ending redirects to `/questionnaire/thank-you/`. Keep it public, text-only and non-collecting; acknowledge receipt, show survey reference `2610281`, explain the review-and-feedback process, and provide team-contact and privacy links.
- Present the questionnaire thank-you route as a minimal Microsoft Forms-like completion screen: centred success state, generous white space, restrained Manchester purple accents, and no report/dashboard layout. Keep the existing copyright and technical-support credit in a white footer.
- The questionnaire completion actions use an explicit `Close` button plus underlined `Contact the team` and `Privacy notice` links. If the browser blocks scripted tab closure, show a concise manual-close instruction.
- Keep both questionnaire completion pages within one common desktop viewport without page scrolling. On desktop, place the centred `Close` button on its own row above the `Contact the team` and `Privacy notice` links; on narrow screens, preserve all content even when scrolling is required.
- Access notices must follow the restrained institutional-document language used by the verification and privacy pages: formal masthead, left-aligned hierarchy, explicit service-status rows, and no generic alert-card decoration.
- Display the visible `Restricted` state in red and describe it as an account-level access restriction, not a pre-release state.
- During the brief permission check or login redirect, show only the verification animation. Do not flash the institutional masthead, explanatory copy, footer, or privacy link before the final access state is known.
- After an allowed account enters the main workspace, expose the workspace directly without a pre-release notice.
- The workspace Home screen includes a `Student reports` entry for authorised representatives to view submitted reports and follow-up requests; keep the report viewer behind the existing full-access permission.
- System activity logs are visible only to `ziwen.mu@chemvault.science`; enforce this on the server as well as hiding the Home entry for every other account. Audit records must never contain email bodies or subjects, student report content, cookies, handoff tokens, OAuth codes or access tokens.
- Email-related audit events identify their operation target only with the protected Message No. and, when available, the Archive ID. Never use the subject, body, recipients or other email content as an audit target.
- The owner-only activity log uses the selected `Forensic Data Grid` admin design: independent full-screen console chrome, dense event table, account-level presence summary and a right-side event/session inspector. Do not wrap it in the public website or mail workspace presentation shell.
- Keep public pages, archives, student reports and the owner-only log viewer available on mobile, but do not mount or open the email editor at viewport widths of 760px or less. Keep the Home email actions clickable; when selected, show a focused desktop-browser requirement dialog, preserve any local draft and return the user to Home after acknowledgement.
- Restricted users must always have a visible `Sign out` action on both the server-rendered and React restriction pages. It must use the existing POST logout flow, clear the local handoff, and allow the trusted User System logout origin through the server-rendered page's `form-action` CSP before redirecting.
- Full-screen notices must not shift the page behind them when opened or dismissed. Keep the root scrollbar and page geometry untouched, contain scrolling at the overlay, and move focus without scrolling.
- Open the public student-report page with a mandatory urgent-help alert dialog on every page entry. Keep emergency and specialist-reporting links usable inside it, require an explicit acknowledgement before the report form can be used, and do not allow backdrop clicks or Escape to dismiss it. Keep a visible control on the page for reopening the support options.
