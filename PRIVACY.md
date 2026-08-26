# Privacy notice draft

SuiFill is a local-first browser extension. The M3 build lets the user enter multiple identity, contact, address, and custom-field records and combine them into reusable scenario presets. It does not inspect or fill web pages yet.

Presets store only local record identifiers, not duplicate copies of the selected personal information. Deleting a source record removes its reference from affected presets before the vault is encrypted again.

The master password is used locally to derive a non-extractable encryption key. The password and key are not persisted or transmitted. Personal information is encrypted before it is written to browser extension storage. Only the encrypted vault envelope, its random salt, its random initialization vector, algorithm metadata, version, and timestamps remain there while the vault is locked.

Custom fields have an explicit sensitivity level. Level-three fields are always excluded from default bulk filling, even if imported or modified outside the user interface. This is enforced by schema validation and data normalization.

SuiFill has no server, account, analytics, advertising, or remote runtime resources. The final notice will expand as page-access, export, and deletion features are implemented.
