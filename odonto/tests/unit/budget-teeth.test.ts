import { describe, expect, it } from "vitest";
import { expandItems, findDuplicates, locationLabel, locationSignature, previewTotal } from "@/domain/budget";
import { archOf, hemiarchOf, isValidTooth, parseTeethList, toothName } from "@/domain/teeth";

describe("numeração FDI", () => {
  it("diferencia permanentes e decíduos", () => {
    expect(isValidTooth(11)).toBe(true);
    expect(isValidTooth(18)).toBe(true);
    expect(isValidTooth(19)).toBe(false);
    expect(isValidTooth(55)).toBe(true);
    expect(isValidTooth(56)).toBe(false);
    expect(isValidTooth(85)).toBe(true);
    expect(isValidTooth(90)).toBe(false);
    expect(toothName(11)).toBe("incisivo central superior direita");
    expect(toothName(75)).toBe("segundo molar inferior esquerda (decíduo)");
    expect(archOf(36)).toBe("lower");
    expect(hemiarchOf(64)).toBe(2);
  });

  it("lê listas e intervalos de dentes", () => {
    expect(parseTeethList("11, 12 21-23")).toEqual({ teeth: [11, 12, 21, 22, 23], invalid: [] });
    expect(parseTeethList("19 18-21").invalid).toEqual(["19", "18-21"]);
  });
});

describe("itens do orçamento", () => {
  it("cenário 6: por dente R$ 600 em dois dentes soma R$ 1.200 com dois itens rastreáveis", () => {
    const items = expandItems({
      billingUnit: "tooth",
      allowedLocations: ["teeth"],
      selection: { kind: "teeth", teeth: [21, 11] },
      quantity: 1,
      unitPriceCents: 60_000,
    });
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.locations)).toEqual([[{ kind: "tooth", tooth: 11 }], [{ kind: "tooth", tooth: 21 }]]);
    expect(previewTotal(items)).toBe(120_000);
  });

  it("cenário 6: global R$ 300 em ambas as arcadas soma R$ 300; por arcada soma R$ 600", () => {
    const global = expandItems({
      billingUnit: "global",
      allowedLocations: ["arches", "none"],
      selection: { kind: "arches", arches: ["upper", "lower"] },
      quantity: 1,
      unitPriceCents: 30_000,
    });
    expect(global).toHaveLength(1);
    expect(previewTotal(global)).toBe(30_000);
    expect(locationLabel(global[0]!.scope, global[0]!.locations)).toBe("Ambas as arcadas");

    const perArch = expandItems({
      billingUnit: "arch",
      allowedLocations: ["arches"],
      selection: { kind: "arches", arches: ["lower", "upper"] },
      quantity: 1,
      unitPriceCents: 30_000,
    });
    expect(perArch).toHaveLength(2);
    expect(previewTotal(perArch)).toBe(60_000);
  });

  it("sessões multiplicam pela quantidade; global sem região não multiplica por dentes", () => {
    const sessions = expandItems({
      billingUnit: "session",
      allowedLocations: ["none", "teeth"],
      selection: { kind: "teeth", teeth: [16] },
      quantity: 3,
      unitPriceCents: 15_000,
    });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.subtotalCents).toBe(45_000);
    const none = expandItems({
      billingUnit: "global",
      allowedLocations: ["none"],
      selection: { kind: "none" },
      quantity: 1,
      unitPriceCents: 9_900,
    });
    expect(locationLabel(none[0]!.scope, none[0]!.locations)).toBe("Sem região");
  });

  it("valida localização incompatível com a unidade de cobrança", () => {
    expect(() =>
      expandItems({
        billingUnit: "tooth",
        allowedLocations: ["teeth", "arches"],
        selection: { kind: "arches", arches: ["upper"] },
        quantity: 1,
        unitPriceCents: 100,
      }),
    ).toThrow(/exige/);
    expect(() =>
      expandItems({
        billingUnit: "global",
        allowedLocations: ["none"],
        selection: { kind: "teeth", teeth: [11] },
        quantity: 1,
        unitPriceCents: 100,
      }),
    ).toThrow(/não permitida/);
    expect(() =>
      expandItems({
        billingUnit: "tooth",
        allowedLocations: ["teeth"],
        selection: { kind: "teeth", teeth: [19] },
        quantity: 1,
        unitPriceCents: 100,
      }),
    ).toThrow(/FDI/);
  });

  it("detecta duplicata de procedimento e localização, ignorando itens recusados", () => {
    const drafts = expandItems({
      billingUnit: "tooth",
      allowedLocations: ["teeth"],
      selection: { kind: "teeth", teeth: [11, 12] },
      quantity: 1,
      unitPriceCents: 100,
    });
    const existing = [
      { procedureId: "p1", signature: locationSignature("teeth", [{ kind: "tooth", tooth: 11 }]), approvalStatus: "pending" as const },
      { procedureId: "p1", signature: locationSignature("teeth", [{ kind: "tooth", tooth: 12 }]), approvalStatus: "rejected" as const },
      { procedureId: "p2", signature: locationSignature("teeth", [{ kind: "tooth", tooth: 12 }]), approvalStatus: "pending" as const },
    ];
    expect(findDuplicates("p1", drafts, existing)).toEqual(["t11"]);
  });
});
