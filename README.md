# SuiFill 随填

SuiFill is a local-first Chrome/Edge extension for maintaining multiple identity, contact, and address profiles and safely filling a user-confirmed selection into the current page.

The project has completed **M6: encrypted per-site rules**. Users can correct unusual fields for a specific hostname, save those mappings inside the encrypted vault, and apply them before review. Safe fill still requires explicit per-field confirmation and never overwrites or submits.

## Privacy baseline

- No server or account system.
- No telemetry or analytics.
- No access to browsing history or cookies.
- No automatic form submission.
- No automatic overwrite of fields that already contain a value.
- Only the final user-checked instructions, never the whole vault, reach the page.
- Level-three custom fields cannot be included in default bulk filling.
- No real personal data in repository fixtures.

## Development

Requirements: Node.js 20+ and pnpm.

```bash
pnpm install
pnpm dev
```

Production checks:

```bash
pnpm check
```

The production Chrome bundle is generated in `.output/chrome-mv3/`.

## Milestones

1. Engineering foundation
2. Local encrypted vault
3. Personal information management
4. Scenario presets
5. Form scanning and classification
6. Fill preview and safe page fill
7. Per-site mapping rules
8. Backup, recovery, and security review
9. Release candidate

The license will be selected before the first public release.
