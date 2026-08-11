import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir:'./test/e2e',
  use:{baseURL:'http://127.0.0.1:4173',trace:'retain-on-failure'},
  webServer:{command:'npm run dev',url:'http://127.0.0.1:4173',reuseExistingServer:true},
  reporter:'line'
});
