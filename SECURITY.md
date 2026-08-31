# Security policy

SuiFill handles high-value personal information and treats permission, cryptography, and data-boundary changes as security-sensitive.

Do not place real personal information, master passwords, encryption keys, exported vaults, or private form captures in issues, commits, logs, or test fixtures.

The responsible-disclosure contact will be added before public release. Until then, do not publish a security-sensitive build.

## M1 cryptographic baseline

- PBKDF2-HMAC-SHA-256 with 600,000 iterations and a 16-byte random salt.
- AES-GCM with a 256-bit non-extractable key and a fresh 12-byte random IV per encryption.
- No password or plaintext persistence. A raw unlock key may exist only in browser session storage for one fixed hour after a successful unlock.
- Uniform unlock failure for incorrect passwords, damaged ciphertext, and invalid decrypted data.
- Fixed one-hour unlock window across side-panel closes; expiry and manual lock clear the session key.

## Page data boundary

- Scanning never reads current form-control values.
- Position-based label recovery is bounded to short visible DOM text near a control; it captures no screenshot and performs no OCR.
- Composite-control detection uses only element rectangles, tag/attribute metadata, and control ordering; it never inspects a calling-code or phone input's current value.
- Non-select composite prefixes are excluded from automatic fill plans, and stale site rules cannot remap a detected phone prefix/main role to an incompatible field type.
- Fill preview values remain in extension-page memory.
- Only user-checked value/locator instructions and their per-action replacement flag reach the scanned page document.
- Non-empty controls are protected by default. Replacement requires an explicit preview checkbox for the current fill action, affects only checked instructions, and is never persisted.
- The filler contains no form submission, page-control click, or navigation call.
- The filler re-resolves each target immediately before writing so framework rerenders cannot leave later instructions pointing at detached controls.
- Per-site rules, including hostnames and field signatures, are encrypted at rest and never apply outside an exact normalized hostname.
- Structurally unlabeled fields receive a bounded ordinal fallback signature. Authenticated legacy vaults affected by an older empty-signature bug discard only those invalid mappings during migration and preserve the remaining vault data.

## Backup and deletion boundary

- Backup exports contain only the encrypted envelope and version metadata.
- Imports are size-bounded, schema-validated, password-verified, and require a second replacement confirmation.
- Password rotation uses a new random salt and non-extractable key.
- Local deletion requires a typed confirmation phrase and removes the persisted encrypted envelope.

The PBKDF2 work factor follows the OWASP Password Storage Cheat Sheet baseline for PBKDF2-HMAC-SHA-256: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
