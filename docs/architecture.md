# Architecture

SuiFill is a Manifest V3 Chrome/Edge extension built with WXT, React, and TypeScript.

## Runtime boundaries

- **Side panel:** owns user interaction. Once encryption is implemented, decrypted vault data may exist only in this extension-page memory.
- **Background service worker:** coordinates browser permissions, script injection, and message routing. It must not retain vault plaintext.
- **Injected page code:** scans the active page and applies a user-confirmed fill plan. It must never receive the complete vault.
- **Browser storage:** local storage holds only the versioned encrypted vault envelope and non-sensitive language setting; session storage may hold the expiring one-hour unlock key.

## Vault cryptography

- PBKDF2-HMAC-SHA-256 derives a non-extractable 256-bit AES key from the master password.
- New vaults use 600,000 PBKDF2 iterations and a random 16-byte salt.
- Vault JSON is authenticated and encrypted with AES-GCM using a fresh random 12-byte IV for every save.
- The password is never persisted. Decrypted plaintext exists only in side-panel memory. A raw unlock key is retained only in Chrome/Edge session storage for one fixed hour so the panel can be reopened without another password entry; expiry and manual lock both clear it.

## On-demand page scanning

- The browser toolbar action is the authorization boundary: its click grants `activeTab` for the current page and opens the side panel. Opening SuiFill directly from Chrome's side-panel picker does not grant page access.
- The side panel asks for the active tab only after the user presses Scan and uses only the temporary grant created by the toolbar action.
- A self-contained injected function collects bounded structural signals from visible, editable form controls, including short nearby label text used by component-library layouts. If semantic DOM relationships are missing, a bounded position-based fallback associates the closest short visible text above or beside a control and treats an adjacent country-code selector plus phone input as one visual group.
- Position matching uses only DOM text fragments and element rectangles. It does not capture screenshots, perform OCR, or read control values.
- Password, hidden, file, checkbox, radio, button, read-only, disabled, and invisible fields are skipped.
- The scanner does not access any control's current value. Classification runs back in the extension page and scan results stay in memory only.
- Standard `autocomplete` tokens have the highest confidence, followed by input type, labels, accessibility labels, field names, and placeholders.

## Review and fill boundary

- A selected preset is resolved to a per-field plan in side-panel memory. The complete vault and preset are never sent to the page.
- High-confidence ordinary matches can be suggested; low-confidence, default-disabled, and level-three custom values require individual selection.
- The final injected payload contains only selected value/locator pairs and is bound to the scanned tab, document ID when available, and hostname.
- The filler refuses to overwrite non-empty controls, refuses values longer than a control's declared maximum, and reports counts without returning page values.
- The filler dispatches normal input/change events but contains no submit, requestSubmit, button-click, navigation, or purchase action.

## Per-site rules

- A user can override classification for a scanned field with a standard semantic type or a custom-field reference.
- Rules are keyed by normalized hostname and use bounded signatures composed of tag, ID, name, and visible field label, with an ordinal fallback for otherwise unlabeled controls. They are stored only inside the encrypted vault.
- Authenticated v0.1.x-v0.2.1 vaults containing the older empty-signature bug are repaired during migration by removing only invalid mappings and preserving all other vault data.
- Explicit site mappings run before fill-plan generation and have full confidence, but custom-field sensitivity/default rules still apply.
- Saving a new rule merges fields from the current scan while preserving rules for other forms on the same hostname. Deleting a custom field atomically removes mappings that reference it.

## Backup and lifecycle

- A `.suifill` backup is a versioned wrapper around the encrypted vault envelope. It contains no plaintext, password, or key.
- Import is size-bounded, schema-validated, and unlocked with the backup's password before replacement requires a second confirmation.
- Password rotation derives a new non-extractable key with a new random salt, then re-encrypts the existing vault.
- Permanent deletion removes the encrypted storage key after the user types an explicit confirmation phrase.

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
