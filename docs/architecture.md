# Architecture

SuiFill is a Manifest V3 Chrome/Edge extension built with WXT, React, and TypeScript.

## Runtime boundaries

- **Side panel:** owns user interaction. Once encryption is implemented, decrypted vault data may exist only in this extension-page memory.
- **Background service worker:** coordinates browser permissions, script injection, and message routing. It must not retain vault plaintext.
- **Injected page code:** scans the active page and applies a user-confirmed fill plan. It must never receive the complete vault.
- **Local storage:** stores only versioned encrypted vault envelopes and non-sensitive bootstrap settings.

## First release constraints

- No server or user account.
- No remote analytics or runtime code.
- No automatic page access.
- No automatic form submission.
- No password or authentication-cookie handling.
