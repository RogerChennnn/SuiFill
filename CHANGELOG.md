# Changelog

## [0.2.9] - 2026-09-01

- Recognize spelled English address labels such as `Address Line One` and `Address Line Two` with the same behavior as numeric and Chinese variants.
- Restore the full-address fallback for line 1 only while keeping an empty line 2 absent from the fill plan.
- Detect Month/Day/Year from all ordered direct field clues when a component layout hides one label behind a group heading.
- Prevent date-part labels and `Phone Type` selectors from being classified as phone-number inputs.

## [0.2.8] - 2026-09-01

- Keep parenthesized Chinese address-line labels distinct so line 1 never fills line 2 when the stored second line is empty.
- Recognize grouped birth-date month/day/year controls, split the stored ISO date into the correct component values, and match numeric month options.
- Give each control's nearest label priority over secondary nearby text and require phone evidence before treating adjacent unequal controls as a composite phone row.
- Add an IBKR-style regression that keeps birth day and year separate from the preceding phone section.

## [0.2.7] - 2026-09-01

- Recognize common simplified- and traditional-Chinese email labels including 电邮地址, 电子信箱地址, and their variants.
- Prevent the generic Chinese word “地址” from classifying an explicit email label as a physical street address.
- Add regression coverage that keeps email labels and physical-address labels semantically separate.

## [0.2.6] - 2026-09-01

- Add an explicit per-fill replacement option so a confirmed English or Chinese profile can replace values already present on the page.
- Keep existing page values protected by default, limit replacement to checked preview items, and never persist the replacement choice.
- Report replacements separately from protected skips and add regressions proving unselected controls remain untouched.

## [0.2.5] - 2026-09-01

- Fix the complete scan-to-fill path for custom phone rows so the full number targets only the main input and never the calling-code component.
- Detect phone prefixes across hidden component inputs or from a rendered `+NN` fragment when the shared wrapper also contains validation text.
- Exclude non-select prefix inputs from fill plans and reject stale site mappings that conflict with composite phone roles.
- Re-query form controls before every fill instruction so React/Vue rerenders cannot make later writes target detached elements while being reported as successful.
- Add end-to-end regressions that build a preset preview and verify the visible main phone input is filled while `+86` remains unchanged.

## [0.2.4] - 2026-09-01

- Fuse separate webpage-code and rendered-position signals, raising confidence when both identify the same field.
- Recognize custom composite phone widgets whose calling-code prefix is an input or non-form component rather than a native select.
- Keep the calling-code prefix and main phone input distinct so the full number is assigned only to the main input.
- Add ByteDance-style regressions for both form-control and non-form calling-code prefixes without reading current control values.

## [0.2.3] - 2026-09-01

- Associate visually adjacent form labels with controls even when a component library places them in separate DOM branches.
- Recognize a phone-number input that shares an overhead label with an adjacent country-code selector.
- Add a ByteDance-style regression fixture for Chinese name, phone, and email fields while verifying that scanning still never reads current control values.

## [0.2.2] - 2026-08-31

- Recover vaults affected by previously saved empty site-field signatures, preserving profile data while removing only invalid mappings.
- Recognize short nearby labels used by component-library forms, including grouped phone country-code and number controls, without reading current form values.
- Replace the ambiguous “incorrect password or damaged vault” notice with precise input-length, case, width, and whitespace guidance.

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
