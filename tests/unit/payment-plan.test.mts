// Hello World
// Executar com: npm run test:unit  (node:test nativo, sem dependências)
import { test } from "node:test"
import assert from "node:assert/strict"
import { buildPaymentPlan, addMonthsClamped, rebalanceSchedule, scheduleTotal, computeDiscount } from "../../lib/payment-plan.ts"

test("12x no cartão a partir de 30/09 (caso dos prints)", () => {
  const p = buildPaymentPlan({ gross: 36000, discount: { mode: "amount", value: 0 }, downPayment: 0, installments: 12, firstDueDate: "2026-09-30", method: "credit_card" })
  assert.equal(p.schedule.length, 12)
  assert.equal(p.schedule[0].amount, 3000)
  assert.deepEqual(p.schedule.map((s) => s.dueDate).slice(0, 7), ["2026-09-30", "2026-10-30", "2026-11-30", "2026-12-30", "2027-01-30", "2027-02-28", "2027-03-30"])
  assert.equal(scheduleTotal(p.schedule), 36000)
})

test("desconto percentual, entrada e centavos exatos", () => {
  const q = buildPaymentPlan({ gross: 1000, discount: { mode: "percent", value: 10 }, downPayment: 100, installments: 3, firstDueDate: "2026-01-31", method: "pix" })
  assert.equal(q.discountAmount, 100)
  assert.equal(q.net, 900)
  assert.equal(q.schedule[0].label, "Entrada")
  assert.deepEqual(q.schedule.slice(1).map((s) => s.amount), [266.67, 266.67, 266.66])
  assert.equal(q.schedule[1].dueDate, "2026-02-28")
  assert.equal(scheduleTotal(q.schedule), 900)
})

test("limites: desconto e entrada nunca excedem o total", () => {
  assert.equal(computeDiscount(50, { mode: "amount", value: 80 }), 50)
  const r = buildPaymentPlan({ gross: 200, discount: { mode: "amount", value: 0 }, downPayment: 500, installments: 4, firstDueDate: "2026-05-10", method: "cash" })
  assert.deepEqual(r.schedule.map((s) => [s.label, s.amount]), [["Entrada", 200]])
})

test("pagamento único quando não há parcelas", () => {
  const s = buildPaymentPlan({ gross: 300, discount: { mode: "amount", value: 0 }, downPayment: 0, installments: 0, firstDueDate: "2026-05-10", method: "pix" })
  assert.deepEqual(s.schedule.map((x) => [x.label, x.amount]), [["1/1", 300]])
})

test("ajuste manual redistribui o saldo e preserva o total", () => {
  const p = buildPaymentPlan({ gross: 36000, discount: { mode: "amount", value: 0 }, downPayment: 0, installments: 12, firstDueDate: "2026-09-30", method: "credit_card" })
  const t = rebalanceSchedule(p.schedule, 0, 6000, p.net)
  assert.equal(t[0].amount, 6000)
  assert.equal(t[1].amount, 2727.28)
  assert.equal(scheduleTotal(t), 36000)
})

test("soma de meses com fim de mês e virada de ano", () => {
  assert.equal(addMonthsClamped("2024-01-31", 1), "2024-02-29")
  assert.equal(addMonthsClamped("2026-12-15", 2), "2027-02-15")
})
