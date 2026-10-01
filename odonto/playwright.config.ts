import { defineConfig } from "@playwright/test";

/**
 * Jornada completa no navegador contra o servidor local com o seed de
 * demonstração (npm run db:local, db:migrate, db:seed-demo, dev).
 * Usa o Chrome instalado (channel) para não depender de download de binários.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 180_000,
  // O servidor de desenvolvimento compila cada rota na primeira visita.
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100",
    channel: process.env.E2E_CHANNEL ?? "chrome",
    viewport: { width: 1440, height: 900 },
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
  },
});
