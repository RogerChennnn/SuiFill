# SuiFill v0.3.0 — Chrome Web Store listing kit

This file contains ready-to-paste listing copy for the English and Simplified Chinese locales. All claims match the current v0.3.0 extension behavior.

## Recommended dashboard choices

- Primary category: `Tools`
- Localized promo video: leave blank for this release; it is optional.
- Official URL: select `None` until a SuiFill website is publicly hosted and verified in Google Search Console.
- Homepage URL: leave blank until the public repository or product site exists.
- Support URL: leave blank until a public support or issue page exists.
- Store icon: `store-icon-128.png`
- Small promo tile: `small-promo-440x280.png`
- Marquee promo tile: `marquee-promo-1400x560.png` (optional, but prepared)

Use these URLs after the public repository has been created:

- Homepage: `https://github.com/RogerChennnn/SuiFill`
- Support: `https://github.com/RogerChennnn/SuiFill/issues`
- Privacy policy: `https://github.com/RogerChennnn/SuiFill/blob/main/PRIVACY.md`

## English locale

### Name

SuiFill — Local-First Form Filler

### Summary

Manage separate local profiles and safely fill web forms after review.

### Description

SuiFill helps you reuse personal information across web forms without giving up control of your data. Create multiple local profiles, combine them into reusable presets, scan the current page, review every proposed match, and fill only the fields you select.

Chinese and English profile spaces are separate. This makes it easy to keep a Chinese name and address for one context and an English name and address for another, without mixing the two.

Key features:

• Save multiple identity, contact, address and custom-field profiles.
• Build reusable presets for work, applications, shopping and other scenarios.
• Keep Chinese and English profiles, presets and site rules independent.
• Recognize common form labels in both Chinese and English.
• Review the source, destination and proposed value for every field before filling.
• Protect existing page values by default, with an explicit option to replace selected values.
• Save encrypted, site-specific matching rules to improve repeat visits.
• Export and import encrypted backups.
• Never submit a page automatically.

Privacy is part of the product design. Your vault is encrypted locally with AES-GCM 256-bit authenticated encryption. Your master password is not saved or uploaded. SuiFill does not require an account, cloud vault, analytics connection, browsing-history permission, cookie access or blanket access to every website.

SuiFill requests temporary access to the current tab only after you choose to scan or fill that page. The extension sends only the user-confirmed fill plan to the page, not the complete vault. You remain responsible for reviewing each value and submitting the form yourself.

## Simplified Chinese locale

### 名称

SuiFill 随填 — 本地加密表单填充

### 简短说明

在本地管理多套中英文个人资料，逐项确认后安全填写网页表单。

### 详细说明

SuiFill 随填帮助你在不同网页表单中重复使用个人资料，同时把数据控制权留在自己手里。你可以创建多套本地资料，把身份、联系方式和地址组合成场景预设，扫描当前页面，逐项检查匹配结果，再只填写自己确认的字段。

中文与英文资料空间彼此独立。你可以在中文场景使用中文姓名和地址，在英文场景使用英文姓名和地址，切换语言时不会把两套资料混在一起。

主要功能：

• 保存多套身份、联系方式、地址和自定义字段资料。
• 按求职、注册、购物等场景建立可重复使用的预设。
• 分开管理中英文资料、预设和网站规则。
• 识别常见的中英文网页表单标签。
• 填写前查看每个字段的来源、目标和预填内容。
• 默认保护网页中已有内容，也可明确选择覆盖指定字段。
• 加密保存网站专属匹配规则，提升下次使用的准确度。
• 导入和导出加密备份。
• 绝不会自动提交网页表单。

隐私保护属于产品设计的一部分。资料库使用 AES-GCM 256 位认证加密，并且只保存在本机。主密码不会被保存或上传。SuiFill 不要求注册账号，不使用云端资料库或分析服务，也不请求浏览历史、Cookie 或所有网站的长期访问权限。

只有当你主动扫描或填写当前页面时，SuiFill 才会请求对当前标签页的临时访问。插件只会把你已经确认的填写计划发送给页面，不会把完整资料库发送给网页。最终检查和提交始终由你亲自完成。

## Permission justifications

Use these explanations in the Privacy practices tab when the dashboard asks why each permission is required.

### activeTab

SuiFill uses `activeTab` to obtain temporary access to the current page only after the user explicitly chooses to scan or fill it. This avoids requesting permanent access to all websites.

### scripting

SuiFill uses `scripting` to run its form scanner and user-confirmed fill plan on the active page. It does not use this permission to submit forms, click confirmation buttons or read unrelated browsing activity.

### storage

SuiFill uses `storage` to keep the locally encrypted vault, user preferences and encrypted site-specific field rules on the user's device. The extension does not use remote storage or upload the vault.

### sidePanel

SuiFill uses `sidePanel` to present profile management, scan results, field-by-field review, security settings and backup controls beside the page being filled.

## Privacy-practice accuracy notes

- The extension handles user-entered personal information locally, so disclose the relevant personal-information categories even though nothing is sold or transmitted to a server.
- State that data is used only for the extension's single purpose: locally storing profiles and filling user-confirmed form fields.
- State that data is not sold, is not used for advertising or credit decisions, and is not transferred except when the user explicitly fills a selected field on the current page or exports a backup.
- The privacy-policy URL must be publicly reachable before submission. A local file path is not accepted.

## Screenshot assignment

### English / global

1. `screenshot-en-01-profiles-1280x800.png` — separate local profile spaces.
2. `screenshot-en-02-review-fill-1280x800.png` — review and fill selected fields.
3. `screenshot-en-03-security-1280x800.png` — local encryption and backup.

### Simplified Chinese

1. `screenshot-zh-01-profiles-1280x800.png` — 中文资料空间和表单填写。

All screenshots use fictional names, `.test` email addresses and fictional example-site content.
