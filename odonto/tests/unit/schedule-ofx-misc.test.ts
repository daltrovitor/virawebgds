import { describe, expect, it } from "vitest";
import { canTransition, formatDuration, snapToSlot, validateTimeRange, whatsappLink } from "@/domain/appointments";
import { buildDailyCashflow } from "@/domain/cashflow";
import { sanitizeCell, toCsv } from "@/domain/csv";
import { ageOn, formatDateBR, instantToZoned, parseDateBR, zonedToInstant } from "@/domain/dates";
import { decodeOfx, parseOfx, parseOfxAmount, transactionFingerprint } from "@/domain/ofx";
import { suggestMatches, validateAllocations } from "@/domain/reconciliation";
import { isValidCpf, maskCpf } from "@/domain/text";

describe("agenda", () => {
  it("cenário 14 (regra): 09h15–10h00 dura 45 minutos na grade de 15", () => {
    expect(validateTimeRange(9 * 60 + 15, 10 * 60)).toBe(45);
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(90)).toBe("1 h 30 min");
    expect(() => validateTimeRange(600, 600)).toThrow(/posterior/);
    expect(() => validateTimeRange(605, 660)).toThrow(/grade/);
    expect(() => validateTimeRange(1380, 1500)).toThrow(/único dia/);
    expect(snapToSlot(608)).toBe(615);
  });

  it("transições de estado explícitas", () => {
    expect(canTransition("scheduled", "confirmed")).toBe(true);
    expect(canTransition("finished", "no_show")).toBe(false);
    expect(canTransition("cancelled_rescheduled", "scheduled")).toBe(false);
  });

  it("atalho de WhatsApp não envia mensagem, apenas monta link", () => {
    expect(whatsappLink("(62) 99999-0000")).toBe("https://wa.me/5562999990000");
    expect(whatsappLink("123")).toBeNull();
  });
});

describe("datas e fuso", () => {
  it("vencimento é data civil; fuso só afeta instantes", () => {
    const instant = zonedToInstant("2026-10-05", 9 * 60 + 15, "America/Sao_Paulo");
    expect(instant.toISOString()).toBe("2026-10-05T12:15:00.000Z");
    expect(instantToZoned(new Date("2026-10-06T02:30:00Z"), "America/Sao_Paulo")).toEqual({ date: "2026-10-05", minutes: 23 * 60 + 30 });
    expect(formatDateBR("2027-02-28")).toBe("28/02/2027");
    expect(parseDateBR("31/02/2027")).toBeNull();
    expect(ageOn("2000-10-02", "2026-10-01")).toBe(25);
    expect(ageOn("2000-10-01", "2026-10-01")).toBe(26);
  });
});

const OFX_SGML = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
ENCODING:USASCII
CHARSET:1252

<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS>
<CURDEF>BRL
<BANKACCTFROM><BANKID>0341<BRANCHID>1234<ACCTID>98765-4<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20261001000000[-3:BRT]
<DTEND>20261031000000[-3:BRT]
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261005120000[-3:BRT]
<TRNAMT>1500.00
<FITID>A1
<MEMO>PIX RECEBIDO PACIENTE DEMO
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261006
<TRNAMT>-89,90
<FITID>A2
<NAME>TARIFA PACOTE
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL><BALAMT>10410.10<DTASOF>20261031</LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>`;

describe("OFX", () => {
  it("lê extrato SGML com vírgula ou ponto decimal", () => {
    const st = parseOfx(decodeOfx(new TextEncoder().encode(OFX_SGML)));
    expect(st.bankId).toBe("0341");
    expect(st.accountId).toBe("98765-4");
    expect(st.periodStart).toBe("2026-10-01");
    expect(st.transactions).toHaveLength(2);
    expect(st.transactions[0]).toMatchObject({ externalId: "A1", amountCents: 150_000, postedOn: "2026-10-05" });
    expect(st.transactions[1]).toMatchObject({ externalId: "A2", amountCents: -8990, name: "TARIFA PACOTE" });
    expect(st.ledgerBalanceCents).toBe(1_041_010);
  });

  it("lê OFX 2 em XML", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><?OFX OFXHEADER="200" VERSION="211"?>
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>BRL</CURDEF>
<BANKACCTFROM><BANKID>001</BANKID><ACCTID>555</ACCTID></BANKACCTFROM>
<BANKTRANLIST><DTSTART>20261001</DTSTART><DTEND>20261002</DTEND>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20261002</DTPOSTED><TRNAMT>-10.5</TRNAMT><NAME>Padaria &amp; Café</NAME></STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
    const st = parseOfx(xml);
    expect(st.transactions[0]).toMatchObject({ externalId: null, amountCents: -1050, name: "Padaria & Café" });
  });

  it("valores e impressões digitais", () => {
    expect(parseOfxAmount("+1.234,56")).toBe(123456);
    expect(parseOfxAmount("1,234.567")).toBe(123457);
    const a = transactionFingerprint("acc", { postedOn: "2026-10-01", amountCents: 100, name: "Café", memo: null });
    const b = transactionFingerprint("acc", { postedOn: "2026-10-01", amountCents: 100, name: "CAFE", memo: null });
    expect(a).toBe(b);
  });

  it("rejeita arquivo que não é OFX", () => {
    expect(() => parseOfx("nome;valor")).toThrow(/OFX/);
  });
});

describe("conciliação", () => {
  it("sugere por valor e data com motivo, sem cruzar sinais", () => {
    const s = suggestMatches(
      { id: "b1", postedOn: "2026-10-05", openAmountCents: 150_000, description: "PIX RECEBIDO PACIENTE DEMO" },
      [
        { id: "m1", occurredOn: "2026-10-05", openAmountCents: 150_000, description: "Recebimento paciente demo" },
        { id: "m2", occurredOn: "2026-10-05", openAmountCents: -150_000, description: "Pagamento" },
        { id: "m3", occurredOn: "2026-09-01", openAmountCents: 150_000, description: "Antigo" },
      ],
    );
    expect(s.map((x) => x.movementId)).toEqual(["m1"]);
    expect(s[0]!.reasons).toContain("Mesmo valor");
  });

  it("recusa alocação que excede saldo", () => {
    const errors = validateAllocations(new Map([["b", 1000]]), new Map([["m", 600]]), [{ bankTransactionId: "b", movementId: "m", amountCents: 700 }]);
    expect(errors.join()).toMatch(/excede/);
  });
});

describe("fluxo de caixa", () => {
  it("cenário 25: projetado usa saldo restante e não duplica o que já foi pago", () => {
    const days = buildDailyCashflow({
      openingCents: 10_000,
      movements: [
        { occurredOn: "2026-10-01", amountCents: 5_000 },
        { occurredOn: "2026-10-02", amountCents: -2_000 },
      ],
      openTitles: [
        { dueDate: "2026-10-04", openCents: 3_000 }, // parcela de 5.000 com 2.000 já recebidos
        { dueDate: "2026-09-20", openCents: -1_000 }, // vencido
      ],
      from: "2026-10-01",
      to: "2026-10-05",
      baseDate: "2026-10-02",
    });
    expect(days[1]!.realizedBalance).toBe(13_000);
    expect(days[2]!.realizedBalance).toBeNull();
    expect(days[2]!.projectedBalance).toBe(12_000);
    expect(days[3]!.projectedBalance).toBe(15_000);
    expect(days[4]!.projectedBalance).toBe(15_000);
  });
});

describe("CSV e documentos", () => {
  it("neutraliza fórmulas maliciosas", () => {
    expect(sanitizeCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(sanitizeCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(sanitizeCell("-12,34")).toBe("-12,34");
    expect(toCsv([{ a: "x;y" }], [{ header: "A", value: (r) => r.a }])).toContain('"x;y"');
  });

  it("CPF válido e mascarado", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(maskCpf("52998224725")).toBe("***.***.247-25");
  });
});
