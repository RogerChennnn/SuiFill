import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: '__MSG_extensionName__',
    short_name: 'SuiFill',
    description: '__MSG_extensionDescription__',
    default_locale: 'en',
    minimum_chrome_version: '114',
    permissions: ['activeTab', 'scripting', 'storage', 'sidePanel'],
    action: {
      default_title: '__MSG_actionTitle__',
    },
  },
});
