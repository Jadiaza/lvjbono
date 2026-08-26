import { describe, expect, it } from "vitest";
import {
  calculateBonoSummary,
  canResponsibleTransition,
  generateDualBonoPairs,
  padBonoNumber,
} from "./bono-domain";

describe("dual bono generation", () => {
  it("creates 500 consecutive bonos with exactly 1000 unique numbers", () => {
    let seed = 17;
    const pairs = generateDualBonoPairs(
      500,
      () => ((seed = (seed * 48271) % 2147483647) - 1) / 2147483646,
    );
    const numbers = pairs.flatMap((pair) => pair.numbers);
    expect(pairs).toHaveLength(500);
    expect(numbers).toHaveLength(1000);
    expect(new Set(numbers).size).toBe(1000);
    expect(Math.min(...numbers)).toBe(0);
    expect(Math.max(...numbers)).toBe(999);
    expect(pairs[0].serial).toBe(1);
    expect(pairs[499].serial).toBe(500);
    expect(pairs.every((pair) => pair.numbers.length === 2)).toBe(true);
  });

  it("rejects campaigns beyond the three-digit capacity", () => {
    expect(() => generateDualBonoPairs(501)).toThrow();
  });
});

describe("dual bono rules", () => {
  it("pads numbers and serials", () => {
    expect(padBonoNumber(0)).toBe("000");
    expect(padBonoNumber(14)).toBe("014");
    expect(padBonoNumber(500)).toBe("500");
  });

  it("restricts responsible state transitions", () => {
    expect(canResponsibleTransition("asignado", "reservado")).toBe(true);
    expect(canResponsibleTransition("reservado", "asignado")).toBe(true);
    expect(canResponsibleTransition("vendido", "pagado")).toBe(true);
    expect(canResponsibleTransition("pagado", "asignado")).toBe(false);
  });

  it("calculates sold, collected and pending values", () => {
    const summary = calculateBonoSummary([
      { status: "vendido", sale_value: 10000, amount_paid: 2000 },
      { status: "pagado", sale_value: 10000, amount_paid: 10000 },
      { status: "asignado", sale_value: 10000, amount_paid: 0 },
    ]);
    expect(summary.counts.vendido).toBe(1);
    expect(summary.counts.pagado).toBe(1);
    expect(summary.soldValue).toBe(20000);
    expect(summary.paidValue).toBe(12000);
    expect(summary.pending).toBe(8000);
  });
});
