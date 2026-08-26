import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'SuiFill 随填',
    short_name: 'SuiFill',
    description: '在本地管理多套个人信息，确认后安全填入当前网页。',
    minimum_chrome_version: '114',
    permissions: ['activeTab', 'scripting', 'storage', 'sidePanel'],
    action: {
      default_title: '打开 SuiFill 随填',
    },
  },
});
