# Initial threat model

## Protected assets

- User-entered identities, contact details, addresses, presets, and site rules.
- The master password and derived vault key.
- The integrity of the encrypted local vault.

## Current controls

- Only an authenticated AES-GCM ciphertext is persisted.
- Each vault has a random salt, and each save has a fresh random IV.
- The derived key is non-extractable and memory-only.
- Wrong passwords and modified ciphertext fail with the same user-facing class of error.
- Closing or reloading the side panel drops the unlocked session.
- Fifteen minutes of side-panel inactivity locks the session.
- High-sensitivity custom fields cannot opt into default bulk filling.
- Presets do not duplicate personal values, and dangling preset references fail schema validation.
- Page scanning requires an explicit click, skips password controls, never reads current control values, and remains memory-only.
- Fill plans remain memory-only and send only checked value/locator pairs to the scanned page document.
- The filler skips existing values and has no submit, click, or navigation capability.
- The target page can read values after they are filled, just as it can read manually typed values.
- Per-site hostnames and field signatures are encrypted at rest; exact-hostname matching prevents a rule from applying to sibling or unrelated domains.
- Site-rule custom references are validated and automatically removed if their source field is deleted.

## Residual risks

- A weak master password can be guessed offline if an attacker obtains the ciphertext.
- Malware or another process controlling the user device may read data while the vault is unlocked.
- Future target websites can read values after the user confirms filling them, just as they can read manually entered values.
- Browser extension updates and third-party dependencies are supply-chain risks and require review.
