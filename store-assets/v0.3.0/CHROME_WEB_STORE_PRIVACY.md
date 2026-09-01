# Chrome Web Store Privacy form — SuiFill v0.3.0

These answers match the audited v0.3.0 source and the public privacy notice.

## Single purpose description

SuiFill has one purpose: to let users manage multiple personal-information profiles in a locally encrypted vault and, after scanning and reviewing the current page, fill only the form fields they explicitly select. SuiFill never submits a form automatically.

## Permission justifications

### activeTab justification

SuiFill uses activeTab only after the user clicks the extension toolbar action. It grants temporary access to the current tab so the user can scan and fill that page without giving SuiFill persistent access to every website. The permission is not used to collect general browsing history.

### scripting justification

SuiFill uses scripting to execute its packaged scanner and user-confirmed filler in the active tab. The scanner reads bounded field labels and structural metadata but never existing form values or password fields. The filler receives only selected locator/value pairs and cannot submit forms, click confirmation buttons, or navigate the page.

### storage justification

SuiFill uses storage to keep the AES-GCM encrypted local vault, locale preference, encrypted site-specific matching rules, and a time-limited unlock key in browser session storage. The master password and decrypted vault plaintext are never persisted, and no vault data is uploaded to remote storage.

### sidePanel justification

SuiFill uses sidePanel to provide its profile manager, security controls, page-scan results, field-by-field preview, and explicit fill confirmation beside the current page. This keeps the review interface visible while the user checks the destination form.

## Remote code

Select:

`No, I am not using remote code`

SuiFill executes only JavaScript bundled inside the submitted extension package. It has no remote scripts, Wasm, eval, dynamic remote modules, analytics, telemetry, or server-provided executable logic.

## Data usage checkboxes

Select these five categories:

- [x] Personally identifiable information
- [x] Authentication information
- [x] Location
- [x] Web history
- [x] Website content

Leave these categories unselected:

- [ ] Health information
- [ ] Financial and payment information
- [ ] Personal communications
- [ ] User activity

The limited web-history disclosure covers only exact hostnames saved inside encrypted, user-created site rules. SuiFill does not request the browser history permission or collect a general list of visited pages. Authentication information covers only transient local processing of the SuiFill master password; website password controls are skipped.

## Required certifications

Select all three:

- [x] I do not sell or transfer user data to third parties, outside of the approved use cases.
- [x] I do not use or transfer user data for purposes unrelated to the item's single purpose.
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes.

## Privacy policy URL

Use this URL after the public repository has been created and the updated policy pushed:

`https://github.com/RogerChennnn/SuiFill/blob/main/PRIVACY.md`
