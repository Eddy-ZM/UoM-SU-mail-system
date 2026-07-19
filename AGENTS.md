# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Pre-approval access restriction

- Keep service entry and in-service content access as separate permissions. `service:uom-su-mail-system:access` alone controls whether a signed-in user may enter the service; preserve its existing assignments and meaning.
- After service entry is allowed, `feature:uom-su-mail-system:full_access` controls the principal workspace and archive features. Deny must show the English full-screen restriction notice and block archive viewing and creation; Allow enables all service features.
- `ziwen.mu@chemvault.science` and `test@chemvault.science` are bootstrap allowed accounts for the content-access permission. An explicit deny still wins. Never copy or couple service-entry decisions into the content-access permission.
- Public verification and privacy pages remain usable, but must present the dismissible restriction notice on entry.
- Access notices must follow the restrained institutional-document language used by the verification and privacy pages: formal masthead, left-aligned hierarchy, explicit service-status rows, and no generic alert-card decoration.
- Display the visible `Restricted` state in red. Use `Pre-release access` without the word `position` in public-notice footers.
- During the brief permission check or login redirect, show only the verification animation. Do not flash the institutional masthead, explanatory copy, footer, or privacy link before the final access state is known.
- After an allowed account enters the main workspace, show a dismissible full-screen pre-release notice before exposing the workspace. State clearly that the account retains full workspace and archive access while formal approval is pending.
- When a restricted user follows a public-page link from the full-screen restriction notice, suppress the otherwise repeated public notice for that navigation and immediately remove the one-time marker from the URL.
- Restricted users must always have a visible `Sign out` action on both the server-rendered and React restriction pages. It must use the existing POST logout flow, clear the local handoff, and allow the trusted User System logout origin through the server-rendered page's `form-action` CSP before redirecting.
- Full-screen notices must not shift the page behind them when opened or dismissed. Keep the root scrollbar and page geometry untouched, contain scrolling at the overlay, and move focus without scrolling.
