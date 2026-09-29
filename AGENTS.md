# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Production access

- Keep service entry and in-service content access as separate permissions. `service:uom-su-mail-system:access` alone controls whether a signed-in user may enter the service; preserve its existing assignments and meaning.
- After service entry is allowed, `feature:uom-su-mail-system:full_access` controls the principal workspace and archive features. It is allowed by default for active users; an explicit Deny must still show the English full-screen restriction notice and block archive viewing and creation.
- `ziwen.mu@chemvault.science` and `test@chemvault.science` remain bootstrap allowed accounts for service entry. An explicit deny still wins. Never copy or couple service-entry decisions into the content-access permission.
- Public verification, reporting and privacy pages remain directly usable without a pre-release notice.
- Access notices must follow the restrained institutional-document language used by the verification and privacy pages: formal masthead, left-aligned hierarchy, explicit service-status rows, and no generic alert-card decoration.
- Display the visible `Restricted` state in red and describe it as an account-level access restriction, not a pre-release state.
- During the brief permission check or login redirect, show only the verification animation. Do not flash the institutional masthead, explanatory copy, footer, or privacy link before the final access state is known.
- After an allowed account enters the main workspace, expose the workspace directly without a pre-release notice.
- Restricted users must always have a visible `Sign out` action on both the server-rendered and React restriction pages. It must use the existing POST logout flow, clear the local handoff, and allow the trusted User System logout origin through the server-rendered page's `form-action` CSP before redirecting.
- Full-screen notices must not shift the page behind them when opened or dismissed. Keep the root scrollbar and page geometry untouched, contain scrolling at the overlay, and move focus without scrolling.
