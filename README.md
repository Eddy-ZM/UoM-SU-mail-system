# Manchester Chemistry Representative Mail Studio

A browser-based visual and HTML editor for English announcements from the Department of Chemistry Student Representatives at The University of Manchester.

The editor is protected by ChemVault User System. A signed-in account must have the `service:uom-su-mail-system:access` permission before any editor entry page is served. Authentication and permission checks run in Cloudflare Pages Functions and fail closed if User System is unavailable. User System handoff works on both the Pages hostname and the production custom domain; its short-lived token is kept only in a host-only, HttpOnly cookie and is reverified for current permission on every editor request. The public Privacy Notice remains available without signing in so students can review it before submitting a form.

The published site also contains the formal Privacy Notice used by the Mail System and by Team-managed Microsoft 365 Forms, surveys, questionnaires and feedback channels:

- `/agreement/privacy-notice/`

## What it does

- Edit approved text regions directly inside the rendered email.
- Select text in the preview and change its font, size, emphasis, colour or alignment.
- Start from Questionnaire, Event, Recruitment, Deadline or General notice presets.
- Use publication-ready English copy; only facts that must be supplied by the sender remain in square brackets.
- Independently show or hide the opening copy, information table, key points, action button, follow-up note, sign-off and contact panel.
- Drag Outlook-safe headings, paragraphs, bullet lists, callouts, dividers and spacing components from the palette into the email preview.
- Reorder or delete body components directly in the preview using Drag, Up, Down and Delete controls.
- Add or delete individual numbered key points and bullet-list items directly inside the preview; numbered lists renumber automatically.
- Synchronise visual changes into the HTML source automatically.
- Apply source-code changes back to the visual preview after a short pause.
- Protect the text-only departmental identity and safety footer from deletion in both the visual builder and HTML source.
- Keep the student-submission privacy wording and Privacy Notice link inside the protected purple email footer.
- Block preview refresh, copying and download after protected source is changed, with one-click restoration.
- Switch between desktop and narrow email previews.
- Keep the current draft in browser-local storage.
- Update the CTA destination and both Student Representative email addresses without editing HTML.
- Generate each contact name from the email prefix automatically, removing digits and separator characters.
- Copy formatted email content for new Outlook.
- Copy the complete HTML source or download a UTF-8 `.html` file.
- Generate a persistent `CHEM-SR-` message number from four cryptographically secure random bytes for every new draft.
- Generate a full SHA-256 over canonical exported HTML, retain it internally, and place a 64-bit formatted lookup code in the protected footer.
- Require a successful immutable D1 backup before Copy HTML, Copy for Outlook or Download HTML can continue.
- Record the full exported HTML and document metadata together with the export operation, verified ChemVault user ID, email, role and server time.
- Search read-only backups by email subject, message number, verification code or SHA-256; only `ziwen.mu@chemvault.science` may delete a backup, enforced by the server.
- Let students verify a message number and short code at the public `/verify/` page and view the archived email title without exposing archived HTML or submitter identity.
- Remove editor-only metadata and unsafe active content from exported HTML.
- Preserve an invisible HTML comment crediting the Student Representatives Team and technical support by Ziwen M.; it never appears in the rendered email.
- Show a fixed website footer with Manchester Student Representatives attribution, technical support credit and a live local clock; this footer is not included in email exports.
- Explain how authorised Student Representatives may access and analyse Microsoft 365 Forms submissions, including retention, sharing and data-subject rights.

To format text, drag across the words inside the email preview. The formatting toolbar will become active and reflect the selection's existing bold, italic, underline, alignment, font, size and colour. Applied formatting is written into the HTML and preserved by Copy for Outlook and Download HTML.

The Questionnaire and General notice presets can be published after checking the destination link and factual details. Event, Recruitment and Deadline presets keep only essential real-world facts such as dates, times, locations and deadlines in square brackets. The Questionnaire preset hides the date/time/location table automatically. Disabled modules and deleted body components remain recoverable in the editing source but are removed completely from copied and downloaded Outlook HTML.

## Local development

```powershell
npm install
npm run dev
```

Production check:

```powershell
npm run build
```

## Cloudflare Pages

Production builds use `npm run build` and publish the `dist` directory. The Cloudflare Pages project is connected to the repository's `main` branch so each push triggers a new production build.

Set `USER_AUTH_ORIGIN` in Cloudflare Pages when the User System origin differs from `https://user.chemvault.science`. The User System handoff start and verify endpoints must recognise the `uom-su-mail-system` audience, return `access.allowed` for the requested permission, and allow the editor's Pages and production hostnames as safe `returnTo` destinations. A shared `.chemvault.science` session cookie is supported as a secondary authentication path on the custom domain.

The archive uses the `ARCHIVE_DB` binding declared in `wrangler.toml`. The configured D1 database is `uom-su-mail-archive` in the European Union jurisdiction. Apply the schema before publishing the Functions that depend on it:

```powershell
npx wrangler d1 migrations apply uom-su-mail-archive --remote
```

For local Pages Functions development, apply the same migration without `--remote` and run Pages with the configuration in `wrangler.toml`. The `email_archives_are_immutable` database trigger rejects every update. The application exposes only create, read, search and owner-only delete operations; it has no archive-update endpoint.
