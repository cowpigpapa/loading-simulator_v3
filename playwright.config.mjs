import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir:'./test/e2e',
  use:{baseURL:'http://127.0.0.1:4174',trace:'retain-on-failure'},
  webServer:{command:'node dev-server.mjs --port=4174',url:'http://127.0.0.1:4174',reuseExistingServer:false},
  reporter:'line'
});
