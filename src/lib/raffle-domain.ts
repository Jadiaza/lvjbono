export type RaffleDigits = 2 | 3;

export function maxNumberForDigits(digits: RaffleDigits): number {
  return 10 ** digits - 1;
}

export function isValidRaffleNumber(number: number, digits: RaffleDigits): boolean {
  return Number.isInteger(number) && number >= 0 && number <= maxNumberForDigits(digits);
}

export function padNumber(number: number, digits: RaffleDigits): string {
  if (!isValidRaffleNumber(number, digits))
    throw new RangeError("Número fuera del rango de la rifa");
  return String(number).padStart(digits, "0");
}

export function normalizeDrawNumber(number: number, digits: RaffleDigits): number {
  const size = maxNumberForDigits(digits) + 1;
  return ((number % size) + size) % size;
}

export function approximations(number: number, digits: RaffleDigits): [number, number] {
  const size = maxNumberForDigits(digits) + 1;
  const normalized = normalizeDrawNumber(number, digits);
  return [(normalized - 1 + size) % size, (normalized + 1) % size];
}

export type PrizeMatch = { prize: string; number: number; amount: number; priority: number };
export type ResolvedPrizeMatch = PrizeMatch & { paid: boolean };

/** Highest amount wins; lower priority is the deterministic tie-breaker. */
export function resolveNonCumulativePrizes(matches: PrizeMatch[]): ResolvedPrizeMatch[] {
  const best = new Map<number, PrizeMatch>();
  for (const match of matches) {
    const current = best.get(match.number);
    if (
      !current ||
      match.amount > current.amount ||
      (match.amount === current.amount && match.priority < current.priority)
    ) {
      best.set(match.number, match);
    }
  }
  return matches.map((match) => ({ ...match, paid: best.get(match.number) === match }));
}

export const formatTicketNumber = padNumber;
