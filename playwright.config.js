import { defineConfig, devices } from '@playwright/test';

// Свой порт, не дев-серверный: см. комментарий в vite.config.mjs.
const PORT = 5273;
export const BASE_URL = `http://localhost:${PORT}`;
// Витрина — ОТДЕЛЬНЫЙ сервер: у неё своя сборка (свой корень, свой base) и своя страница.
// До сих пор витрину не открывал ни один браузерный гейт, и она прожила четыре PR с
// нерабочим сценарием, мусорными примерами и фокусом, уходящим в свёрнутое.
const SHOWCASE_PORT = 5274;
export const SHOWCASE_URL = `http://localhost:${SHOWCASE_PORT}`;

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
  webServer: [
    {
      command: 'npm run dev',
      url: `${BASE_URL}/Storybook.dc.html`, // корень отвечает 302 — пробе нужна страница

      // Никогда не переиспользуем чужой сервер: на этом порту его быть не должно, а если
      // есть — это ошибка окружения, а не повод молча проверять неизвестно что.
      reuseExistingServer: false,
      stdout: 'ignore',
      stderr: 'pipe',
      env: { CI: '1', DS_PORT: String(PORT) }, // CI=1 — не открывать браузер хостовой машины
    },
    {
      command: 'npm run dev:showcase',
      url: SHOWCASE_URL,
      reuseExistingServer: false,
      stdout: 'ignore',
      stderr: 'pipe',
      env: { CI: '1', DS_PORT: String(SHOWCASE_PORT) },
    },
  ],
});
