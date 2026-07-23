import { describe, expect, it } from "vitest";
import {
  approximations,
  formatTicketNumber,
  isValidRaffleNumber,
  maxNumberForDigits,
  normalizeDrawNumber,
  padNumber,
  resolveNonCumulativePrizes,
} from "./raffle-domain";

describe("raffle numbers", () => {
  it("formats and validates both sizes", () => {
    expect(padNumber(0, 2)).toBe("00");
    expect(formatTicketNumber(7, 3)).toBe("007");
    expect(maxNumberForDigits(2)).toBe(99);
    expect(maxNumberForDigits(3)).toBe(999);
    expect(isValidRaffleNumber(100, 2)).toBe(false);
    expect(isValidRaffleNumber(999, 3)).toBe(true);
  });
  it("wraps approximations", () => {
    expect(approximations(0, 2)).toEqual([99, 1]);
    expect(approximations(99, 2)).toEqual([98, 0]);
    expect(approximations(0, 3)).toEqual([999, 1]);
    expect(approximations(999, 3)).toEqual([998, 0]);
    expect(normalizeDrawNumber(1234, 3)).toBe(234);
  });
});

describe("non-cumulative prizes", () => {
  it("pays the highest amount and preserves discarded matches", () => {
    const result = resolveNonCumulativePrizes([
      { prize: "Mayor", number: 12, amount: 100, priority: 0 },
      { prize: "Seco 1", number: 12, amount: 500, priority: 1 },
      { prize: "Seco 2", number: 20, amount: 80, priority: 2 },
    ]);
    expect(result.map(({ prize, paid }) => [prize, paid])).toEqual([
      ["Mayor", false],
      ["Seco 1", true],
      ["Seco 2", true],
    ]);
  });
  it("uses priority for amount ties", () => {
    const result = resolveNonCumulativePrizes([
      { prize: "Seco", number: 1, amount: 100, priority: 1 },
      { prize: "Mayor", number: 1, amount: 100, priority: 0 },
    ]);
    expect(result.find((item) => item.paid)?.prize).toBe("Mayor");
  });
});
