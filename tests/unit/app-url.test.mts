// Hello World
// Executar com: npm run test:unit  (node:test nativo, sem dependências)
import { test } from "node:test"
import assert from "node:assert/strict"
import { ADMIN_URL, APP_URL, appOriginFor } from "../../lib/brand.ts"

test("app e admin apontam para o domínio atual, não para o viraweb.online morto", () => {
  assert.equal(APP_URL, "https://odonto.viraweb.dev.br")
  assert.equal(ADMIN_URL, "https://admin.viraweb.dev.br")
})

test("qualquer host da marca redireciona para o app", () => {
  assert.equal(appOriginFor("https://odonto.viraweb.dev.br"), APP_URL)
  assert.equal(appOriginFor("https://admin.viraweb.dev.br"), APP_URL)
  assert.equal(appOriginFor("https://viraweb.online"), APP_URL)
  assert.equal(appOriginFor("https://gdc.viraweb.online"), APP_URL)
  assert.equal(appOriginFor("https://ODONTO.ViraWeb.dev.br"), APP_URL)
})

test("localhost e previews mantêm a própria origem", () => {
  assert.equal(appOriginFor("http://localhost:3200"), "http://localhost:3200")
  assert.equal(appOriginFor("https://vwo-git-main.vercel.app"), "https://vwo-git-main.vercel.app")
  assert.equal(appOriginFor("https://notviraweb.dev.br"), "https://notviraweb.dev.br")
})
