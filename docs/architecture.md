# Architecture

SuiFill is a Manifest V3 Chrome/Edge extension built with WXT, React, and TypeScript.

## Runtime boundaries

- **Side panel:** owns user interaction. Once encryption is implemented, decrypted vault data may exist only in this extension-page memory.
- **Background service worker:** coordinates browser permissions, script injection, and message routing. It must not retain vault plaintext.
- **Injected page code:** scans the active page and applies a user-confirmed fill plan. It must never receive the complete vault.
- **Local storage:** stores only versioned encrypted vault envelopes and non-sensitive bootstrap settings.

## Vault cryptography

- PBKDF2-HMAC-SHA-256 derives a non-extractable 256-bit AES key from the master password.
- New vaults use 600,000 PBKDF2 iterations and a random 16-byte salt.
- Vault JSON is authenticated and encrypted with AES-GCM using a fresh random 12-byte IV for every save.
- The password and derived key are never persisted. The unlocked key and plaintext exist only in side-panel memory and are discarded on lock, reload, or panel close.
- The current inactivity timeout is 15 minutes and resets only on interaction inside the side panel.

## Personal-data model

- Identities, contacts, addresses, and custom fields are independent records so the user can maintain multiple versions of each.
- Each record has a stable random ID plus creation and update timestamps.
- Every data mutation produces a new vault value and immediately reseals the complete vault with a fresh AES-GCM IV before storage.
- Custom fields have a sensitivity level. Level-three fields are normalized to disallow default bulk filling and are rejected by validation if this invariant is violated.
- Scenario presets reference the stable IDs of base records rather than copying their values. Deleting a base record atomically clears its references, and vault validation rejects dangling references.

## First release constraints

- No server or user account.
- No remote analytics or runtime code.
- No automatic page access.
- No automatic form submission.
- No password or authentication-cookie handling.
