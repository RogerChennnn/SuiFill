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
- Fill preview values remain in extension-page memory.
- Only user-checked value/locator instructions reach the scanned page document.
- Non-empty controls are never overwritten.
- The filler contains no form submission, page-control click, or navigation call.
- Per-site rules, including hostnames and field signatures, are encrypted at rest and never apply outside an exact normalized hostname.

## Backup and deletion boundary

- Backup exports contain only the encrypted envelope and version metadata.
- Imports are size-bounded, schema-validated, password-verified, and require a second replacement confirmation.
- Password rotation uses a new random salt and non-extractable key.
- Local deletion requires a typed confirmation phrase and removes the persisted encrypted envelope.

The PBKDF2 work factor follows the OWASP Password Storage Cheat Sheet baseline for PBKDF2-HMAC-SHA-256: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
