# SuiFill 随填

SuiFill is a local-first Chrome/Edge extension for maintaining multiple identity, contact, and address profiles and safely filling a user-confirmed selection into the current page.

The project has completed **M1: local encrypted vault**. It can create, lock, and unlock an empty encrypted vault, but it does not yet store or fill personal information.

## Privacy baseline

- No server or account system.
- No telemetry or analytics.
- No access to browsing history or cookies.
- No automatic form submission.
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
