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
- No content script exists yet, so no vault data is sent to a page in M2.

## Residual risks

- A weak master password can be guessed offline if an attacker obtains the ciphertext.
- Malware or another process controlling the user device may read data while the vault is unlocked.
- Future target websites can read values after the user confirms filling them, just as they can read manually entered values.
- Browser extension updates and third-party dependencies are supply-chain risks and require review.
