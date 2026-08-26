# Browser permissions

SuiFill requests only these Manifest V3 permissions:

| Permission  | Reason                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------- |
| `activeTab` | Temporarily access the current tab after an explicit user gesture. No persistent site access. |
| `scripting` | Inject the bounded scanner/filler only into the user-invoked active tab.                      |
| `storage`   | Persist the encrypted local vault and extension settings.                                     |
| `sidePanel` | Show the review and confirmation interface beside the page.                                   |

SuiFill must not request `<all_urls>`, `tabs`, `history`, `cookies`, or `webRequest` for the MVP.

M4 uses `activeTab` and `scripting` only when the unlocked user presses **Scan current page**. The scan payload excludes every field's current value and is not persisted.
