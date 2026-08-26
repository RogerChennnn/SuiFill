# Test plan

Each milestone must add tests at the lowest practical level.

- Unit tests: schemas, encryption, classification, confidence, and data transforms.
- Integration tests: encrypted storage, unlock, presets, scan-to-plan messaging.
- End-to-end tests: install, create vault, unlock, scan, preview, fill, export, import.
- Security checks: no plaintext persistence, no unrequested network calls, no permission expansion, and no automatic submit.

The current standard fixture intentionally contains only fictional empty form fields.

M2 adds unit coverage for typed record validation, immutable add/edit/delete operations, alias normalization, forced exclusion of high-sensitivity fields from default filling, and encrypted round-tripping of a populated vault.

M3 adds unit coverage for reference-only presets, duplicate-reference normalization, automatic unlinking on source deletion, and dangling-reference rejection.
