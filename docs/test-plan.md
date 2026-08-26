# Test plan

Each milestone must add tests at the lowest practical level.

- Unit tests: schemas, encryption, classification, confidence, and data transforms.
- Integration tests: encrypted storage, unlock, presets, scan-to-plan messaging.
- End-to-end tests: install, create vault, unlock, scan, preview, fill, export, import.
- Security checks: no plaintext persistence, no unrequested network calls, no permission expansion, and no automatic submit.

The current standard fixture intentionally contains only fictional empty form fields.

M2 adds unit coverage for typed record validation, immutable add/edit/delete operations, alias normalization, forced exclusion of high-sensitivity fields from default filling, and encrypted round-tripping of a populated vault.

M3 adds unit coverage for reference-only presets, duplicate-reference normalization, automatic unlinking on source deletion, and dangling-reference rejection.

M4 adds table-driven unit coverage for standard autocomplete tokens, input types, Chinese and English labels, accessibility labels, field names, placeholders, ambiguous names, and unknown fields. Production checks must also confirm there are still no host permissions.

M5 adds unit coverage for preset-to-field resolution, address/contact precedence, custom alias matching, empty-source exclusion, low-confidence defaults, and level-three explicit confirmation. Production checks also reject submit, requestSubmit, and click calls in the injected filler.

M6 adds unit coverage for hostname isolation, semantic overrides, direct custom-field mapping, preset membership, dangling-reference rejection, and automatic cleanup when a custom field is deleted.

M7 adds unit coverage for encrypted backup serialization/restore, malformed backup rejection, password rotation, old-password rejection, new random salt, and permanent local storage deletion.

M8 adds an isolated browser smoke test at a side-panel viewport plus release-time static gates for permissions, network calls, logs, scanner value access, and filler submission/click calls. See `release-checklist.md`.
