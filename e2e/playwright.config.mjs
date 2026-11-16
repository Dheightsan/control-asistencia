import { defineConfig } from '@playwright/test';
import { PUERTO_WEB } from './entorno.mjs';

// Base de datos, API y web los levanta global-setup.mjs, para poder apagarlos bien al terminar.
export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.mjs',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PUERTO_WEB}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
