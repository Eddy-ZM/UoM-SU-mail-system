# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Pre-approval access restriction

- Until approval is obtained from the University of Manchester Department of Chemistry and the relevant departments, users denied `service:uom-su-mail-system:access` must receive the English full-screen restriction notice instead of the main service.
- `ziwen.mu@chemvault.science` and `test@chemvault.science` are the bootstrap allowed accounts. Deny must block archive viewing and creation; Allow enables all service features.
- Public verification and privacy pages remain usable, but must present the dismissible restriction notice on entry.
- Access notices must follow the restrained institutional-document language used by the verification and privacy pages: formal masthead, left-aligned hierarchy, explicit service-status rows, and no generic alert-card decoration.
- Display the visible `Restricted` state in red. Use `Pre-release access` without the word `position` in public-notice footers.
- During the brief permission check or login redirect, show only the verification animation. Do not flash the institutional masthead, explanatory copy, footer, or privacy link before the final access state is known.
- After an allowed account enters the main workspace, show a dismissible full-screen pre-release notice before exposing the workspace. State clearly that the account retains full workspace and archive access while formal approval is pending.
- When a restricted user follows a public-page link from the full-screen restriction notice, suppress the otherwise repeated public notice for that navigation and immediately remove the one-time marker from the URL.
- Restricted users must always have a visible `Sign out` action on both the server-rendered and React restriction pages. It must use the existing POST logout flow and clear the local handoff before redirecting through User System logout.
- The public verification page primarily serves students checking an announcement. Its notice must describe announcement verification in student-facing language, state that sign-in is not required, and avoid exposing internal workspace or archive-permission status.
