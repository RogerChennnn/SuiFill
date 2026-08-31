# SuiFill 随填

SuiFill is a local-first Chrome/Edge extension for maintaining multiple identity, contact, and address profiles and safely filling a user-confirmed selection into the current page.

Chinese and English operate as equivalent but separate data workspaces: each keeps its own profiles, presets, and per-site rules, while the scanner recognizes common field labels in both languages.

The project has completed **M8: technical release candidate**. All nine implementation milestones are complete, including isolated browser smoke testing and production packaging. Public publication remains intentionally gated on the project owner's license and contact choices.

## Privacy baseline

- No server or account system.
- No telemetry or analytics.
- No access to browsing history or cookies.
- No automatic form submission.
- No automatic overwrite of fields that already contain a value.
- Only the final user-checked instructions, never the whole vault, reach the page.
- Exported backups remain encrypted and cannot be restored without their original master password.
- Users can permanently delete the local encrypted vault.
- Any non-empty master password is accepted, and an unlock remains valid for one fixed hour in browser session storage unless the user locks manually.
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

## Install the local release candidate

1. Run `pnpm install` and `pnpm build`, or unzip the generated Chrome release artifact.
2. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select `.output/chrome-mv3/` (or the unzipped artifact folder).
5. Pin SuiFill and open it by clicking its browser-toolbar icon. This click grants temporary access to the current page and opens the side panel.
6. Create a master password. After navigating to a different site, click the toolbar icon again before scanning.

Use only fictional information while evaluating a release candidate. Chrome/Edge will show that a developer-mode extension is unpacked; this is expected for a GitHub-distributed test build.

## Release artifact

Run `pnpm zip` to generate the Chrome/Edge Manifest V3 zip in `.output/`. The zip is intended for release packaging or store submission; users loading directly from GitHub should unzip it and load the contained extension folder.

See [`docs/release-checklist.md`](docs/release-checklist.md) for completed technical gates and the human decisions required before public distribution.

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

No software license has been granted yet. The project owner must deliberately select one before the first public release.
