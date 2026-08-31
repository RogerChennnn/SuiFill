# Release checklist

## Automated gates

- [x] Prettier check passes.
- [x] TypeScript strict compilation passes.
- [x] All unit tests pass.
- [x] Chrome Manifest V3 production build passes.
- [x] Release zip is generated.
- [x] Manifest contains only `activeTab`, `scripting`, `storage`, and `sidePanel`.
- [x] Manifest contains no host permissions.
- [x] Scanner source does not read form-control values.
- [x] Injected filler contains no submit, requestSubmit, or click call.
- [x] Application source contains no fetch, XMLHttpRequest, WebSocket, sendBeacon, analytics, or telemetry call.
- [x] Application source contains no console logging.
- [x] Browser toolbar action explicitly opens the side panel so its click grants `activeTab` for the current page.

## Browser smoke test

The v0.1.x flow was completed on 2026-08-27 at a 430 × 900 side-panel viewport with an isolated local storage/page mock and fictional `.test` data. The v0.2.2 dual-workspace UI still requires a fresh manual Chrome and Edge smoke test.

- [x] First-run UI renders with labeled password controls.
- [x] Create encrypted vault.
- [x] Add identity, contact, and address records.
- [x] Create a preset that references all three records.
- [x] Scan a fictional page with one skipped password field.
- [x] Generate a three-item preview and fill only confirmed items.
- [x] Save and immediately apply an exact-hostname field override.
- [x] Rotate the master password, lock, and unlock with the new password.
- [x] No browser console errors or warnings.
- [x] Focus styles, reduced-motion behavior, labels, headings, status regions, and destructive-action confirmation are present.

## Candidate artifact

- File: `.output/suifill-0.2.2-chrome.zip`
- SHA-256: `3CBCC52EF022332E6EA5115B46DA70C341F329F75EAA6ADA164DB5649157CCB8`
- Contents: Manifest V3 extension bundle only; no test harness, source map, backup, or personal-data fixture.

## Human gates before public distribution

- [ ] Project owner chooses a license. This is intentionally not assumed because an open-source license grant cannot be retroactively withdrawn from existing recipients.
- [ ] Project owner adds a responsible-disclosure and privacy contact.
- [ ] Project owner tests the unpacked build on representative real sites using fictional data only.
- [ ] Project owner reviews Chrome Web Store / Edge Add-ons policies and listing disclosures.
- [ ] Project owner reviews dependency audit output in the release environment.
- [ ] Project owner signs/tags the release and publishes the verified artifact hash.

The unchecked human gates block public publication, not local testing of the release candidate.
