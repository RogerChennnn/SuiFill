# Security policy

SuiFill handles high-value personal information and treats permission, cryptography, and data-boundary changes as security-sensitive.

Do not place real personal information, master passwords, encryption keys, exported vaults, or private form captures in issues, commits, logs, or test fixtures.

The responsible-disclosure contact will be added before public release. Until then, do not publish a security-sensitive build.

## M1 cryptographic baseline

- PBKDF2-HMAC-SHA-256 with 600,000 iterations and a 16-byte random salt.
- AES-GCM with a 256-bit non-extractable key and a fresh 12-byte random IV per encryption.
- No password, key, or plaintext persistence.
- Uniform unlock failure for incorrect passwords, damaged ciphertext, and invalid decrypted data.
- Fifteen-minute in-panel inactivity lock.

The PBKDF2 work factor follows the OWASP Password Storage Cheat Sheet baseline for PBKDF2-HMAC-SHA-256: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
