# SuiFill Privacy Notice

Effective date: 2026-09-01

SuiFill is a local-first browser extension for managing multiple sets of personal information and filling a user-reviewed selection into the current web page. This notice describes the data boundary implemented by the open-source extension.

## What SuiFill stores

The user may enter identity details, contact details, addresses, custom fields, scenario presets, and per-site field mappings. All of this content, including site-rule hostnames and field signatures, is kept inside one authenticated encrypted vault in browser extension storage.

The stored envelope contains AES-GCM ciphertext plus the random salt, random initialization vector, algorithm metadata, format versions, and timestamps needed to unlock it. The master password is never persisted or transmitted. After a successful unlock, a raw unlock key is retained only in browser session storage for one fixed hour so the side panel can be reopened without another password entry. Manual lock, expiry, vault deletion, or browser-session termination clears it.

## Data categories handled

For Chrome Web Store disclosure purposes, SuiFill handles the following categories on the user's device:

- **Personally identifiable information:** user-entered names, usernames, contact details, addresses, personal links, nationality or region, and identifiers placed in custom fields.
- **Authentication information:** the local master password is processed transiently to derive the vault encryption key. It is never stored or transmitted. SuiFill skips website password controls and does not scan, store, or fill website passwords.
- **Location:** only locations the user deliberately enters, such as an address, country, region, state, province, or city. SuiFill does not request or derive GPS location or the user's IP address.
- **Limited web history:** when the user explicitly saves a site-specific matching rule, the exact hostname is stored in the encrypted vault with the rule. SuiFill does not request the browser history permission or collect a general browsing history.
- **Website content:** after an explicit scan action, SuiFill reads bounded form labels and structural metadata from the current page as described below. It does not capture screenshots, read page media, or collect existing form values.

SuiFill is not designed to collect health information, financial or payment information, personal communications, or user-activity telemetry.

## Local processing and network use

SuiFill has no server, account system, analytics, advertising, telemetry, or remote runtime code. It does not send the vault, password, browsing history, form structure, scan results, or usage events to the developer or another service.

The extension requests no persistent access to all websites. Page access is temporary and begins only after a user invokes the extension and presses the scan or fill control.

## Page scanning

The scanner reads bounded structural metadata from visible, editable form controls: standard labels, short nearby label text, the relative on-page position of those short text fragments and controls, field names and IDs, input types, autocomplete hints, placeholders, and limited accessibility labels. Position matching is performed locally from DOM geometry; SuiFill does not capture a screenshot or use OCR. It skips password, hidden, file, button, checkbox, radio, disabled, read-only, and invisible controls.

The scanner never reads the current value of an input, select, or textarea. Scan results remain in side-panel memory and disappear when the panel closes, reloads, or locks.

## Review and filling

SuiFill creates a per-field preview in extension memory. High-sensitivity, default-disabled, and low-confidence items require individual selection. Only the value and bounded locator for each checked item are injected into the exact tab and page document that was scanned; the page never receives the vault or preset.

The filler protects non-empty fields by default. In the preview, the user may explicitly enable replacement for the current fill action; that permission applies only to checked fields, is not persisted, and sends only the same bounded locator/value instruction plus the per-action replacement flag. The filler contains no form-submit, page-control click, purchase, registration, navigation, or next-step operation. After filling, the destination page can read those values just as it can read information typed manually. The user is responsible for reviewing the destination site's own privacy practices before continuing.

## Per-site rules

Optional site rules store a normalized hostname, bounded field signatures, and references to standard or custom data fields. They do not duplicate the referenced personal-data value. Rules are encrypted at rest and apply only to the exact hostname.

## Backups, password changes, and deletion

Exported `.suifill` backups remain encrypted and require the master password that was active when they were created. SuiFill cannot recover a forgotten password and has no recovery key or backdoor. A backup is validated and unlocked before the user can confirm replacement of the current vault.

Changing the master password derives a new key with a new random salt and re-encrypts the vault. Old backups continue to require their old password.

The user can permanently remove the local encrypted vault from the extension. This cannot delete copies the user previously exported or values already sent to a destination website.

## Retention and user control

Vault data remains in browser extension storage until the user edits it, deletes the vault, clears extension data, or uninstalls the extension according to the browser's behavior. SuiFill does not keep a server-side copy.

## Chrome Web Store Limited Use disclosure

SuiFill's use of information received through Chrome extension APIs complies with the Chrome Web Store User Data Policy, including the Limited Use requirements. Data is used only to provide or improve SuiFill's single purpose: locally managing user-created profiles and filling user-confirmed fields on the current page.

SuiFill does not sell user data, transfer it for advertising or unrelated purposes, use it to determine creditworthiness or for lending, or allow the developer or other humans to read it. The only ordinary disclosure occurs when the user explicitly confirms filling selected values into a destination page, after which that destination page can read those values just as if the user had typed them manually. An encrypted backup is created only when the user explicitly exports one.

## Security limitations

Encryption at rest does not protect data while the vault is unlocked from malware, a compromised browser or operating system, malicious extension updates, physical observation, or a destination page receiving confirmed values. SuiFill accepts any non-empty password for usability, including one character, but longer unique passwords are materially safer. Users should install releases from a trusted source, review fill previews, and keep encrypted backups in a safe location.

## Changes and contact

Material privacy changes must be documented in the repository and release notes before a release. Questions, privacy requests, and security concerns may be submitted through the public SuiFill repository at https://github.com/RogerChennnn/SuiFill/issues.
