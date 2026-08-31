# Changelog

## [0.2.1] - 2026-08-31

- Refine the side panel into a quieter Apple-inspired interface with a translucent utility bar, inset grouped sections, native-style segmented controls, and restrained system colors.
- Increase form-control clarity, touch-target consistency, typography hierarchy, responsive spacing, and reduced-motion support without changing any stored data or filling behavior.

## [0.2.0] - 2026-08-31

- Add fully separate Chinese and English data workspaces, including independent profiles, presets, and site rules.
- Add searchable controlled choices for title, gender, pronouns, nationality, and country/region, with migration from v0.1.x data.
- Add region, Telegram, Instagram, WhatsApp, and three Additional Link fields; remove preferred language.
- Accept any non-empty master password and remember an unlocked vault for one fixed hour in browser session storage.
- Expand bilingual form-field recognition aliases and refresh the side-panel interface around the puzzle logo.

## [0.1.1] - 2026-08-28

- Fix the Chrome side-panel authorization flow by handling the toolbar action explicitly, and explain that opening SuiFill from the side-panel picker does not grant temporary page access.

All notable changes to SuiFill will be documented in this file.

## [0.1.0-rc.1] - 2026-08-27

### Added

- Local AES-GCM encrypted vault protected by a PBKDF2-derived master key.
- Multiple identity, contact, address, and sensitivity-aware custom-field records.
- Reference-based scenario presets and encrypted exact-hostname field rules.
- User-invoked form scanning with semantic classification and confidence.
- Per-field review that sends only checked instructions to the scanned page document.
- Non-overwriting form filling with no submit, click, purchase, registration, or navigation action.
- Encrypted backup export, password-verified restore, master-password rotation, inactivity lock, and permanent local deletion.
- Privacy notice, threat model, permission rationale, tests, and Chrome/Edge release packaging.

### Release status

This is a technical release candidate. A public distribution still requires the project owner to choose a software license and publish a responsible-disclosure contact.
