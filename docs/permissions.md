# Browser permissions

SuiFill requests only these Manifest V3 permissions:

| Permission  | Reason                                                             |
| ----------- | ------------------------------------------------------------------ |
| `activeTab` | Temporarily access the current tab after an explicit user gesture. |
| `scripting` | Inject the scanner/filler into the user-invoked active tab.        |
| `storage`   | Persist the encrypted local vault and extension settings.          |
| `sidePanel` | Show the review and confirmation interface beside the page.        |

SuiFill must not request `<all_urls>`, `tabs`, `history`, `cookies`, or `webRequest` for the MVP.
