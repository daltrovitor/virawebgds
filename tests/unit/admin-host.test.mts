// Hello World
// Executar com: npm run test:unit  (node:test nativo, sem dependências)
import { test } from "node:test"
import assert from "node:assert/strict"
import { isAdminHost } from "../../lib/admin-host.ts"

test("subdomínio admin em qualquer domínio da marca abre o painel", () => {
  assert.equal(isAdminHost("admin.viraweb.dev.br"), true)
  assert.equal(isAdminHost("admin.viraweb.online"), true)
  assert.equal(isAdminHost("ADMIN.ViraWeb.dev.br"), true)
})

test("porta e ponto final do host não atrapalham", () => {
  assert.equal(isAdminHost("admin.localhost:3000"), true)
  assert.equal(isAdminHost("admin.viraweb.dev.br."), true)
})

test("site público e outros subdomínios não viram admin", () => {
  assert.equal(isAdminHost("odonto.viraweb.dev.br"), false)
  assert.equal(isAdminHost("www.viraweb.dev.br"), false)
  assert.equal(isAdminHost("localhost:3000"), false)
  assert.equal(isAdminHost("superadmin.viraweb.dev.br"), false)
  assert.equal(isAdminHost("viraweb.dev.br"), false)
  assert.equal(isAdminHost(""), false)
  assert.equal(isAdminHost(null), false)
})
