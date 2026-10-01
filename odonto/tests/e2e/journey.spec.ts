import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * Jornada: cadastro → orçamento (odontograma, preço editável, desconto, plano)
 * → aprovação → agenda (criar, arrastar, redimensionar) → recebimento → OFX →
 * conciliação. Dados sintéticos do seed de demonstração.
 */
const EMAIL = process.env.E2E_EMAIL ?? "admin@demo.odonto.test";
const PASSWORD = process.env.E2E_PASSWORD ?? process.env.DEMO_PASSWORD ?? "demo-odonto-2026";

async function login(page: Page) {
  await page.goto("/entrar");
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/visao-geral|selecionar-clinica/);
  if (page.url().includes("selecionar-clinica")) {
    await page.getByRole("button", { name: /Clínica Demonstração/ }).click();
    await expect(page).toHaveURL(/visao-geral/);
  }
}

/** Dia útil futuro e único por execução, para não colidir com execuções anteriores. */
function uniqueWeekday(seed: number): string {
  const d = new Date(Date.UTC(2027, 2, 1) + (seed % 600) * 86_400_000);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

test("jornada completa da clínica", async ({ page }) => {
  const suffix = Date.now().toString().slice(-6);
  const patientName = `Paciente E2E ${suffix}`;
  await login(page);

  // 1. Cadastro com campos mínimos
  await page.goto("/pacientes/novo");
  await page.locator("#fullName").fill(patientName);
  await page.locator("#phone").fill(`6299${suffix}00`);
  await page.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(page.getByRole("heading", { level: 1, name: patientName })).toBeVisible();
  const patientUrl = page.url();

  // 2. Orçamento dentro da ficha
  await page.getByRole("button", { name: "Novo orçamento" }).click();
  await page.getByRole("button", { name: "Criar e montar" }).click();
  await expect(page.getByText("Incluir procedimento")).toBeVisible();
  await page.locator("#it-spec").selectOption({ label: "Prótese" });
  await page.locator("#it-proc").selectOption({ label: "PRT-02 — Coroa em zircônia" });
  await page.locator('button[aria-label^="Dente 11:"]').click();
  await page.locator('button[aria-label^="Dente 21:"]').click();
  await page.locator("#it-price").fill("2.400,00");
  await expect(page.getByText("2 item(ns) × R$ 2.400,00 = R$ 4.800,00")).toBeVisible();
  await page.getByRole("button", { name: "Incluir no orçamento" }).click();
  await expect(page.getByRole("cell", { name: "Dente 21" })).toBeVisible();
  // Trocar a especialidade limpa o procedimento incompatível
  await page.locator("#it-spec").selectOption({ label: "Dentística" });
  await expect(page.locator("#it-proc")).toHaveValue("");
  await page.locator("#it-proc").selectOption({ label: "DEN-01 — Restauração em resina (1 face)" });
  await page.locator('button[aria-label^="Dente 11:"]').click();
  await page.getByRole("button", { name: "Incluir no orçamento" }).click();
  await expect(page.getByRole("cell", { name: /Restauração em resina/ })).toBeVisible();

  // 3. Negociação: 10% de desconto, entrada R$ 1.000 e 3 parcelas
  await page.locator("#ng-dtype").selectOption({ label: "Percentual" });
  await page.locator("#ng-dpct").fill("10");
  await page.locator("#ng-down").fill("1.000,00");
  await page.locator("#ng-count").fill("3");
  await page.getByRole("button", { name: "Gerar parcelas" }).click();
  await expect(page.getByText("— fecha o total.")).toBeVisible();
  await page.getByRole("button", { name: "Aprovar orçamento" }).click();
  await page.getByRole("button", { name: "Confirmar aprovação" }).click();
  await expect(page.getByText("Acordo de pagamento vigente")).toBeVisible();
  await expect(page.getByRole("cell", { name: /Parcela 3\/3/ })).toBeVisible();

  // 4. Agenda: 09:15–10:00 = 45 min, persiste, arrastar e redimensionar
  const patientId = patientUrl.split("/pacientes/")[1]!.split("?")[0]!;
  const day = uniqueWeekday(Number(suffix));
  await page.goto(`/agenda?nova=1&paciente=${patientId}&data=${day}&modo=dia`);
  await page.locator("#ap-start").selectOption({ label: "09:15" });
  await page.locator("#ap-end").selectOption({ label: "10:00 (45 min)" });
  await expect(page.getByText("Duração: 45 min")).toBeVisible();
  await page.locator("dialog label", { hasText: "Coroa em zircônia · Dente 11" }).locator("input").check();
  await page.locator("dialog footer").getByRole("button", { name: "Agendar" }).click();
  await expect(page.getByText(/Consulta agendada/)).toBeVisible();
  await page.goto(`/agenda?data=${day}&modo=dia`);
  const card = page.locator(`button[aria-label^="${patientName}"]`);
  await expect(card).toHaveAttribute("aria-label", new RegExp(`${patientName}, 09:15 a 10:00`));
  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 8);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + box.width / 2, box.y + 8 + i * 4);
  await page.mouse.up();
  await expect(card).toHaveAttribute("aria-label", /09:45 a 10:30/);

  // 5. Recebimento da entrada (Pix) na ficha
  await page.goto(`${patientUrl.split("?")[0]}?aba=financeiro`);
  await page.locator("tr", { hasText: "Entrada" }).getByRole("button", { name: "Receber" }).click();
  await page.locator("#st-account").selectOption({ label: "Banco Demo — conta corrente" });
  await page.locator("dialog footer").getByRole("button", { name: "Confirmar" }).click();
  await expect(page.locator("tr", { hasText: "Entrada" }).getByText("Quitado")).toBeVisible();

  // 6. OFX com o Pix e conciliação com o recebimento existente
  const dir = mkdtempSync(join(tmpdir(), "e2e-ofx-"));
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const ofx = join(dir, "extrato.ofx");
  writeFileSync(
    ofx,
    `OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\nCHARSET:1252\n\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>BRL\n<BANKACCTFROM><BANKID>999<ACCTID>00012-3</BANKACCTFROM>\n<BANKTRANLIST><DTSTART>${today}<DTEND>${today}\n<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>${today}<TRNAMT>1000.00<FITID>E2E${suffix}<MEMO>PIX ${patientName.toUpperCase()}</STMTTRN>\n</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`,
  );
  await page.goto("/financeiro/conciliacao");
  await page.locator("#ofx").setInputFiles(ofx);
  await page.getByRole("button", { name: "Ler e pré-visualizar" }).click();
  await expect(page).toHaveURL(/\/financeiro\/conciliacao\/importacao\//);
  await expect(page.getByText("Nova", { exact: true })).toBeVisible();
  const ack = page.getByLabel("Revisei os avisos");
  if (await ack.count()) await ack.check();
  await page.getByRole("button", { name: "Confirmar importação" }).click();
  await page.locator(`input[aria-label="Selecionar PIX ${patientName.toUpperCase()}"]`).check();
  // A sugestão traz o nome do paciente na descrição do recebimento.
  const movement = page.locator(`input[aria-label*="${patientName}"]`);
  await movement.check();
  await page.getByRole("button", { name: "Conciliar selecionados" }).click();
  await expect(page.getByText("Conciliação registrada")).toBeVisible();
});
