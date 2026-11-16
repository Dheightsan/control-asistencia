import { defineConfig } from '@playwright/test';

// Puertos distintos a los de desarrollo para no chocar con `npm run dev`.
const PUERTO_DB = 54330;
const PUERTO_API = 3101;
const PUERTO_WEB = 3100;

// En CI hay un postgres como servicio (DATABASE_URL); en local levantamos uno embebido.
const baseDeDatos =
  process.env.DATABASE_URL ?? `postgres://asistencia:asistencia@localhost:${PUERTO_DB}/asistencia`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PUERTO_WEB}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: [
    ...(process.env.DATABASE_URL
      ? []
      : [
          {
            command: 'node scripts/postgres-embebido.mjs',
            cwd: '..',
            env: { PG_PORT: String(PUERTO_DB), PG_DIR: '.pgdata-e2e' },
            port: PUERTO_DB,
            timeout: 120_000,
          },
        ]),
    {
      command: 'npm run build -w api && npm run start -w api',
      cwd: '..',
      env: {
        DATABASE_URL: baseDeDatos,
        API_PORT: String(PUERTO_API),
        WEB_ORIGIN: `http://localhost:${PUERTO_WEB}`,
      },
      url: `http://localhost:${PUERTO_API}/trabajadores`,
      timeout: 180_000,
    },
    {
      command: `npm run build -w web && npm run start -w web -- --port ${PUERTO_WEB}`,
      cwd: '..',
      env: { NEXT_PUBLIC_API_URL: `http://localhost:${PUERTO_API}` },
      url: `http://localhost:${PUERTO_WEB}`,
      timeout: 240_000,
    },
  ],
});
