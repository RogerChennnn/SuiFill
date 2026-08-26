# SuiFill agent instructions

These rules apply to the entire repository.

1. Keep the extension local-first. Do not add a server, telemetry, analytics, remote fonts, or remote runtime resources without explicit approval.
2. Do not expand Manifest permissions without explicit approval and a matching update to `docs/permissions.md`.
3. Never use real personal information in source, fixtures, tests, screenshots, logs, or documentation.
4. Never log a vault plaintext, master password, derived key, decrypted field value, or sensitive form value.
5. A content script may receive only the user-confirmed fill plan, never the complete vault.
6. Never submit a page form or click a purchase, registration, confirmation, or next-step button.
7. Every new behavior requires focused tests. Run `pnpm check` before considering a milestone complete.
8. Any persistent data schema change requires a version and migration plan.
9. Changes to crypto, message boundaries, imports, exports, or permissions require a security review and documentation update.
10. Preserve unrelated user changes and keep each task within its named milestone.
