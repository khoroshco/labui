import { defineConfig, devices } from '@playwright/test';

export const BASE_URL = 'http://localhost:5173';

export default defineConfig({
  testDir: 'tests',
  // Эталоны лежат в одном месте и не привязаны к файлу теста: их снимает снапшот-тест
  // с DC-версии, а сверяет с ними ещё и паритетный харнесс React. Один эталон на двоих —
  // это и есть смысл паритета.
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}-{projectName}-{platform}{ext}',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0, // гейт обязан быть детерминированным: ретрай прячет гонку, а не чинит её
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: `${BASE_URL}/Storybook.dc.html`, // корень отвечает 302 — пробе нужна страница

    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
    env: { CI: '1' }, // не открывать браузер хостовой машины
  },
});
