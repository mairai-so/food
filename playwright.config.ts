import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: false,
  retries: 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    {
      command: 'PORT=5000 DATABASE_URL=postgresql://postgres:postgres@localhost:5432/miar JWT_SECRET=playwright-local-validation pnpm --filter @workspace/api-server dev',
      url: 'http://localhost:5000/api/restaurants',
      reuseExistingServer: true,
      timeout: 120 * 1000,
    },
    {
      command: 'PORT=5173 API_PROXY_TARGET=http://localhost:5000 pnpm --filter @workspace/gestor dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 120 * 1000,
    },
    {
      command: 'PORT=5177 API_PROXY_TARGET=http://localhost:5000 pnpm --filter @workspace/garcom dev',
      url: 'http://localhost:5177',
      reuseExistingServer: true,
      timeout: 120 * 1000,
    },
    {
      command: 'PORT=5175 API_PROXY_TARGET=http://localhost:5000 pnpm --filter @workspace/cozinha dev',
      url: 'http://localhost:5175',
      reuseExistingServer: true,
      timeout: 120 * 1000,
    },
    {
      command: 'PORT=5174 API_PROXY_TARGET=http://localhost:5000 pnpm --filter @workspace/caixa dev',
      url: 'http://localhost:5174',
      reuseExistingServer: true,
      timeout: 120 * 1000,
    },
    {
      command: 'PORT=5176 API_PROXY_TARGET=http://localhost:5000 pnpm --filter @workspace/entregador dev',
      url: 'http://localhost:5176',
      reuseExistingServer: true,
      timeout: 120 * 1000,
    },
    {
      command: 'PORT=5178 API_PROXY_TARGET=http://localhost:5000 pnpm --filter @workspace/cliente dev',
      url: 'http://localhost:5178',
      reuseExistingServer: true,
      timeout: 120 * 1000,
    },
    {
      command: 'PORT=5179 API_PROXY_TARGET=http://localhost:5000 pnpm --filter @workspace/gestor-mobile dev',
      url: 'http://localhost:5179',
      reuseExistingServer: true,
      timeout: 120 * 1000,
    },
    {
      command: 'PORT=5180 API_PROXY_TARGET=http://localhost:5000 pnpm --filter @workspace/equipe dev',
      url: 'http://localhost:5180',
      reuseExistingServer: true,
      timeout: 120 * 1000,
    },
  ],
});
